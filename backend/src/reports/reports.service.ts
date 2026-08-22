import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CalculationStatus,
  MarkSheetStatus,
  Prisma,
  VerificationSessionStatus,
} from '@prisma/client';
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
type NavigationYear = {
  id: string;
  name: string;
  ordinal: number;
  students: number;
  classes: number;
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly config: ConfigService,
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

  navigation(actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const classes = await tx.academicClass.findMany({
        where: { tenantId: actor.tenantId },
        include: {
          program: { include: { department: true } },
          studyYear: true,
          sections: {
            where: { tenantId: actor.tenantId },
            include: { _count: { select: { students: true } } },
          },
        },
        orderBy: { name: 'asc' },
      });
      const departments = new Map<
        string,
        {
          id: string;
          code: string;
          name: string;
          years: Map<string, NavigationYear>;
        }
      >();
      for (const academicClass of classes) {
        const department = academicClass.program.department;
        const entry = departments.get(department.id) ?? {
          id: department.id,
          code: department.code,
          name: department.name,
          years: new Map<string, NavigationYear>(),
        };
        const year = entry.years.get(academicClass.studyYear.id) ?? {
          id: academicClass.studyYear.id,
          name: academicClass.studyYear.displayName,
          ordinal: academicClass.studyYear.ordinal,
          students: 0,
          classes: 0,
        };
        year.students += academicClass.sections.reduce(
          (sum, section) => sum + section._count.students,
          0,
        );
        year.classes += 1;
        entry.years.set(year.id, year);
        departments.set(entry.id, entry);
      }
      return [...departments.values()].map((department) => ({
        id: department.id,
        code: department.code,
        name: department.name,
        years: [...department.years.values()].sort(
          (a, b) => a.ordinal - b.ordinal,
        ),
      }));
    });
  }

  classReport(query: ReportQueryDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const where = this.where(query, actor.tenantId);
      const [total, sheets] = await Promise.all([
        tx.markSheet.count({ where }),
        tx.markSheet.findMany({
          where,
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
          orderBy: [{ student: { registerNumber: 'asc' } }, { attempt: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);
      const data = sheets.map((sheet) => {
        const calculation = sheet.calculationResults[0];
        const marks = Object.fromEntries(
          (sheet.verificationSessions[0]?.items ?? []).map((item) => {
            const scheme = item.extractedMark.markingSchemeItem;
            const question =
              scheme.question?.label ?? `Item ${scheme.displayOrder}`;
            return [
              scheme.questionPart?.label
                ? `${question}(${scheme.questionPart.label})`
                : question,
              item.selectedMarkValue?.value.toString() ?? null,
            ];
          }),
        );
        return {
          markSheetId: sheet.id,
          registerNumber: sheet.student.registerNumber,
          studentName: sheet.student.fullName,
          subject: sheet.subjectOffering.subject.name,
          subjectCode: sheet.subjectOffering.subject.code,
          questionPaperCode: sheet.questionPaperVersion.questionPaper.code,
          marks,
          attempt: sheet.attempt,
          total: calculation?.grandTotal.toString() ?? null,
          maximum: calculation?.maximumMark.toString() ?? null,
          percentage: calculation?.percentage.toString() ?? null,
          status: calculation?.status ?? sheet.status,
        };
      });
      return {
        columns: [...new Set(data.flatMap((row) => Object.keys(row.marks)))],
        data,
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

  exportData(query: ReportQueryDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const maximumRows = Number(
        this.config.get<string | number>('EXPORT_MAX_ROWS', 10000),
      );
      if (
        !Number.isSafeInteger(maximumRows) ||
        maximumRows < 1 ||
        maximumRows > 100000
      )
        throw new Error('EXPORT_MAX_ROWS must be between 1 and 100000');
      const sheets = await tx.markSheet.findMany({
        where: this.where(query, actor.tenantId),
        include: {
          ...this.tenantReportInclude(actor.tenantId),
          markingSchemeVersion: { include: { items: true } },
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
        orderBy: [{ student: { registerNumber: 'asc' } }, { createdAt: 'asc' }],
        take: maximumRows + 1,
      });
      if (sheets.length > maximumRows)
        throw new BadRequestException(
          `Export exceeds the configured ${maximumRows}-row limit; narrow the filters`,
        );
      if (!sheets.length)
        throw new NotFoundException('No mark sheets match the export filters');
      if (
        sheets.some(
          (sheet) =>
            sheet.status !== MarkSheetStatus.COMPLETED ||
            sheet.calculationResults[0]?.status !==
              CalculationStatus.READY_FOR_EXPORT ||
            !sheet.verificationSessions[0],
        )
      )
        throw new BadRequestException(
          'Export scope contains marks that are not fully verified and ready for export',
        );
      return sheets.map((sheet) => {
        const offering = sheet.subjectOffering;
        const academicClass = offering.section.class;
        const department = academicClass.program.department;
        const calculation = sheet.calculationResults[0];
        const selected = new Map(
          sheet.verificationSessions[0].items.map((item) => [
            item.extractedMark.markingSchemeItemId,
            item.selectedMarkValue?.value.toString() ?? null,
          ]),
        );
        const marks = sheet.markingSchemeVersion.items
          .filter((item) => item.isScorable)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((item) => {
            const verificationItem = sheet.verificationSessions[0].items.find(
              (entry) => entry.extractedMark.markingSchemeItemId === item.id,
            );
            const scheme = verificationItem?.extractedMark.markingSchemeItem;
            const question =
              scheme?.question?.label ?? `Item ${item.displayOrder}`;
            const part = scheme?.questionPart?.label;
            return {
              key: part ? `${question}(${part})` : question,
              value: selected.get(item.id) ?? null,
              maximum: item.maximumMark.toString(),
            };
          });
        return {
          university: department.college.university.name,
          college: department.college.name,
          department: department.name,
          program: academicClass.program.name,
          academicYear: offering.academicYear.code,
          studyYear: academicClass.studyYear.displayName,
          semester: offering.semester.displayName,
          class: academicClass.name,
          section: offering.section.name,
          subject: offering.subject.name,
          subjectCode: offering.subject.code,
          questionPaperCode: sheet.questionPaperVersion.questionPaper.code,
          student: sheet.student.fullName,
          registerNumber: sheet.student.registerNumber,
          marks,
          groupTotals: calculation.groupTotals as Record<string, string>,
          grandTotal: calculation.grandTotal.toString(),
          maximum: calculation.maximumMark.toString(),
          percentage: calculation.percentage.toString(),
          verificationStatus: calculation.status,
        };
      });
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
