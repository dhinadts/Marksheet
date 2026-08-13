import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VersionStatus } from '@prisma/client';
import { AccessClaims } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PageQueryDto, pageResult } from '../common/dto/page-query.dto';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import {
  CreateQuestionPaperDto,
  CreateQuestionPaperVersionDto,
} from './question-paper.dto';

@Injectable()
export class QuestionPapersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}
  list(query: PageQueryDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const where: Prisma.QuestionPaperWhereInput = {
        tenantId: actor.tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { title: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        tx.questionPaper.findMany({
          where,
          include: {
            subject: { select: { code: true, name: true } },
            versions: {
              select: {
                id: true,
                version: true,
                status: true,
                markingSchemeVersionId: true,
              },
              orderBy: { version: 'desc' },
            },
          },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        tx.questionPaper.count({ where }),
      ]);
      return pageResult(items, total, query);
    });
  }
  create(dto: CreateQuestionPaperDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      if (
        !(await tx.subject.findFirst({
          where: { id: dto.subjectId, tenantId: actor.tenantId },
        }))
      )
        throw new BadRequestException(
          'subjectId does not reference a subject in this tenant',
        );
      const paper = await tx.questionPaper.create({
        data: { ...dto, tenantId: actor.tenantId },
      });
      await this.audit.record(
        tx,
        actor,
        'CREATE',
        'questionPaper',
        paper.id,
        undefined,
        paper,
      );
      return paper;
    });
  }
  createVersion(
    paperId: string,
    dto: CreateQuestionPaperVersionDto,
    actor: AccessClaims,
  ) {
    const questionCodes = new Set(dto.questions.map((q) => q.code));
    const orders = new Set(dto.questions.map((q) => q.displayOrder));
    if (
      questionCodes.size !== dto.questions.length ||
      orders.size !== dto.questions.length
    )
      throw new BadRequestException(
        'Question codes and display orders must be unique',
      );
    for (const question of dto.questions) {
      if (
        new Set(question.parts.map((p) => p.code)).size !==
          question.parts.length ||
        new Set(question.parts.map((p) => p.displayOrder)).size !==
          question.parts.length
      )
        throw new BadRequestException(
          `Part codes and display orders must be unique within ${question.code}`,
        );
    }
    return this.tenant.transaction(this.prisma, async (tx) => {
      if (
        !(await tx.questionPaper.findFirst({
          where: { id: paperId, tenantId: actor.tenantId },
        }))
      )
        throw new NotFoundException();
      const latest = await tx.questionPaperVersion.aggregate({
        where: { tenantId: actor.tenantId, questionPaperId: paperId },
        _max: { version: true },
      });
      const created = await tx.questionPaperVersion.create({
        data: {
          tenantId: actor.tenantId,
          questionPaperId: paperId,
          version: (latest._max.version ?? 0) + 1,
          instructions: dto.instructions,
          createdById: actor.sub,
          questions: {
            create: dto.questions.map((question) => ({
              tenantId: actor.tenantId,
              code: question.code,
              label: question.label,
              groupCode: question.groupCode,
              displayOrder: question.displayOrder,
              isRequired: question.isRequired ?? true,
              parts: {
                create: question.parts.map((part) => ({
                  tenantId: actor.tenantId,
                  code: part.code,
                  label: part.label,
                  displayOrder: part.displayOrder,
                  isRequired: part.isRequired ?? true,
                })),
              },
            })),
          },
        },
        include: {
          questions: {
            include: { parts: { orderBy: { displayOrder: 'asc' } } },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      await this.audit.record(
        tx,
        actor,
        'CREATE_VERSION',
        'questionPaperVersion',
        created.id,
        undefined,
        { paperId, version: created.version },
      );
      return created;
    });
  }
  preview(paperId: string, version: number, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const result = await tx.questionPaperVersion.findFirst({
        where: { tenantId: actor.tenantId, questionPaperId: paperId, version },
        include: {
          questionPaper: true,
          questions: {
            include: { parts: { orderBy: { displayOrder: 'asc' } } },
            orderBy: { displayOrder: 'asc' },
          },
        },
      });
      if (!result) throw new NotFoundException();
      return result;
    });
  }
  publish(paperId: string, version: number, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const draft = await tx.questionPaperVersion.findFirst({
        where: { tenantId: actor.tenantId, questionPaperId: paperId, version },
        include: { questions: true },
      });
      if (!draft) throw new NotFoundException();
      if (draft.status !== VersionStatus.DRAFT)
        throw new ConflictException('Only a draft version can be published');
      if (!draft.questions.length)
        throw new BadRequestException(
          'A version must contain at least one question',
        );
      const publishedScheme = await tx.markingSchemeVersion.findFirst({
        where: {
          tenantId: actor.tenantId,
          questionPaperVersionId: draft.id,
          status: VersionStatus.PUBLISHED,
        },
        select: { id: true },
      });
      if (!publishedScheme)
        throw new BadRequestException(
          'Publish a valid marking scheme for this paper version first',
        );
      const published = await tx.questionPaperVersion.update({
        where: { id: draft.id },
        data: {
          status: VersionStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedById: actor.sub,
        },
      });
      await this.audit.record(
        tx,
        actor,
        'PUBLISH',
        'questionPaperVersion',
        draft.id,
        { status: draft.status },
        {
          status: published.status,
          publishedAt: published.publishedAt?.toISOString(),
        },
      );
      return published;
    });
  }
}
