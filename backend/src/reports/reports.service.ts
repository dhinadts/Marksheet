import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VerificationSessionStatus } from '@prisma/client';
import type { AccessClaims } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { ReportQueryDto } from './reports.dto';
import { summarizeRows } from './report-projection';

const reportInclude = {
  student: true,
  subjectOffering: {
    include: {
      subject: true,
      academicYear: true,
      semester: true,
      section: {
        include: {
          class: {
            include: {
              studyYear: true,
              program: {
                include: {
                  department: {
                    include: { college: { include: { university: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  questionPaperVersion: { include: { questionPaper: true } },
  calculationResults: {
    orderBy: { calculationVersion: 'desc' as const },
    take: 1,
  },
  extractedMarks: { select: { confidence: true } },
} satisfies Prisma.MarkSheetInclude;
type ReportSheet = Prisma.MarkSheetGetPayload<{
  include: typeof reportInclude;
}>;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  summary(query: ReportQueryDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const sheets = await tx.markSheet.findMany({
        where: this.where(query, actor.tenantId),
        include: this.tenantReportInclude(actor.tenantId),
        orderBy: { createdAt: 'desc' },
      });
      const summary = summarizeRows(
        sheets.map((sheet) => ({
          status: sheet.status,
          calculationStatus: sheet.calculationResults[0]?.status,
          confidence: this.averageConfidence(sheet.extractedMarks),
          dimensions: this.dimensions(sheet),
        })),
      );
      return {
        ...summary,
        cards: {
          totalStudents: new Set(sheets.map((sheet) => sheet.studentId)).size,
          ...summary.cards,
        },
      };
    });
  }

  classReport(query: ReportQueryDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const where = this.where(query, actor.tenantId);
      const [total, sheets] = await Promise.all([
        tx.markSheet.count({ where }),
        tx.markSheet.findMany({
          where,
          include: this.tenantReportInclude(actor.tenantId),
          orderBy: [{ student: { registerNumber: 'asc' } }, { attempt: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      return {
        data: sheets.map((sheet) => {
          const calculation = sheet.calculationResults[0];
          return {
            markSheetId: sheet.id,
            registerNumber: sheet.student.registerNumber,
            studentName: sheet.student.fullName,
            subject: sheet.subjectOffering.subject.name,
            subjectCode: sheet.subjectOffering.subject.code,
            attempt: sheet.attempt,
            total: calculation?.grandTotal.toString() ?? null,
            maximum: calculation?.maximumMark.toString() ?? null,
            percentage: calculation?.percentage.toString() ?? null,
            status: calculation?.status ?? sheet.status,
          };
        }),
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          pageCount: Math.ceil(total / query.pageSize),
        },
      };
    });
  }

  studentReport(studentId: string, query: ReportQueryDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, tenantId: actor.tenantId },
      });
      if (!student) throw new NotFoundException();
      const sheets = await tx.markSheet.findMany({
        where: { ...this.where(query, actor.tenantId), studentId },
        include: {
          ...this.tenantReportInclude(actor.tenantId),
          verificationSessions: {
            where: {
              tenantId: actor.tenantId,
              status: VerificationSessionStatus.APPROVED,
            },
            orderBy: { completedAt: 'desc' },
            take: 1,
            include: {
              items: {
                where: { tenantId: actor.tenantId },
                include: {
                  selectedMarkValue: true,
                  extractedMark: {
                    include: {
                      markingSchemeItem: {
                        include: { question: true, questionPart: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        student: {
          id: student.id,
          registerNumber: student.registerNumber,
          fullName: student.fullName,
        },
        subjects: sheets.map((sheet) => {
          const calculation = sheet.calculationResults[0];
          const marks = (sheet.verificationSessions[0]?.items ?? [])
            .map((item) => ({
              itemId: item.extractedMark.markingSchemeItem.id,
              displayOrder: item.extractedMark.markingSchemeItem.displayOrder,
              question:
                item.extractedMark.markingSchemeItem.question?.label ??
                'Unlabelled',
              part:
                item.extractedMark.markingSchemeItem.questionPart?.label ??
                null,
              mark: item.selectedMarkValue?.value.toString() ?? null,
              maximum:
                item.extractedMark.markingSchemeItem.maximumMark.toString(),
            }))
            .sort((a, b) => a.displayOrder - b.displayOrder);
          return {
            markSheetId: sheet.id,
            subject: sheet.subjectOffering.subject,
            questionPaper: sheet.questionPaperVersion.questionPaper.code,
            marks,
            groupTotals: calculation?.groupTotals ?? null,
            grandTotal: calculation?.grandTotal.toString() ?? null,
            maximum: calculation?.maximumMark.toString() ?? null,
            percentage: calculation?.percentage.toString() ?? null,
            status: calculation?.status ?? sheet.status,
          };
        }),
      };
    });
  }

  private where(
    query: ReportQueryDto,
    tenantId: string,
  ): Prisma.MarkSheetWhereInput {
    return {
      tenantId,
      ...(query.subjectOfferingId && {
        subjectOfferingId: query.subjectOfferingId,
      }),
      ...(query.search && {
        student: {
          OR: [
            { registerNumber: { contains: query.search, mode: 'insensitive' } },
            { fullName: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      }),
      subjectOffering: {
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.programId && { programId: query.programId }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
        ...(query.semesterId && { semesterId: query.semesterId }),
        ...(query.sectionId && { sectionId: query.sectionId }),
        section: {
          ...(query.classId && { classId: query.classId }),
          class: {
            ...(query.studyYearId && { studyYearId: query.studyYearId }),
            program: {
              ...(query.programId && { id: query.programId }),
              department: {
                ...(query.departmentId && { id: query.departmentId }),
                college: {
                  ...(query.collegeId && { id: query.collegeId }),
                  ...(query.universityId && {
                    universityId: query.universityId,
                  }),
                },
              },
            },
          },
        },
      },
    };
  }

  private averageConfidence(marks: { confidence: Prisma.Decimal | null }[]) {
    const values = marks.flatMap((mark) =>
      mark.confidence ? [mark.confidence.toNumber()] : [],
    );
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;
  }

  private tenantReportInclude(tenantId: string) {
    return {
      ...reportInclude,
      calculationResults: {
        ...reportInclude.calculationResults,
        where: { tenantId },
      },
      extractedMarks: {
        ...reportInclude.extractedMarks,
        where: { tenantId },
      },
    };
  }

  private dimensions(sheet: ReportSheet) {
    const offering = sheet.subjectOffering;
    const academicClass = offering.section.class;
    const department = academicClass.program.department;
    const college = department.college;
    return {
      university: { id: college.university.id, name: college.university.name },
      college: { id: college.id, name: college.name },
      department: { id: department.id, name: department.name },
      program: {
        id: academicClass.program.id,
        name: academicClass.program.name,
      },
      studyYear: {
        id: academicClass.studyYear.id,
        name: academicClass.studyYear.displayName,
      },
      semester: {
        id: offering.semester.id,
        name: offering.semester.displayName,
      },
      class: { id: academicClass.id, name: academicClass.name },
      section: { id: offering.section.id, name: offering.section.name },
      subject: { id: offering.subject.id, name: offering.subject.name },
    };
  }
}
