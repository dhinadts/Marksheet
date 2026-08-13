import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, VersionStatus } from '@prisma/client';
import type { AccessClaims } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PageQueryDto, pageResult } from '../common/dto/page-query.dto';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import {
  CreateMarkingSchemeDto,
  CreateMarkingSchemeVersionDto,
} from './marking-scheme.dto';
import { MarkingSchemeValidator } from './marking-scheme-validator';

@Injectable()
export class MarkingSchemesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly validator: MarkingSchemeValidator,
  ) {}

  list(query: PageQueryDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const where: Prisma.MarkingSchemeWhereInput = {
        tenantId: actor.tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { code: { contains: query.search, mode: 'insensitive' } },
                { name: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };
      const [data, total] = await Promise.all([
        tx.markingScheme.findMany({
          where,
          include: {
            questionPaper: { select: { code: true, title: true } },
            versions: {
              select: {
                version: true,
                status: true,
                maximumMark: true,
                questionPaperVersionId: true,
              },
              orderBy: { version: 'desc' },
            },
          },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        tx.markingScheme.count({ where }),
      ]);
      return pageResult(data, total, query);
    });
  }

  create(dto: CreateMarkingSchemeDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      if (
        !(await tx.questionPaper.findFirst({
          where: { id: dto.questionPaperId, tenantId: actor.tenantId },
        }))
      )
        throw new BadRequestException(
          'questionPaperId does not reference a paper in this tenant',
        );
      const created = await tx.markingScheme.create({
        data: { ...dto, tenantId: actor.tenantId },
      });
      await this.audit.record(
        tx,
        actor,
        'CREATE',
        'markingScheme',
        created.id,
        undefined,
        created,
      );
      return created;
    });
  }

  createVersion(
    schemeId: string,
    dto: CreateMarkingSchemeVersionDto,
    actor: AccessClaims,
  ) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const scheme = await tx.markingScheme.findFirst({
        where: { id: schemeId, tenantId: actor.tenantId },
      });
      if (!scheme) throw new NotFoundException();
      const paperVersion = await tx.questionPaperVersion.findFirst({
        where: {
          id: dto.questionPaperVersionId,
          tenantId: actor.tenantId,
          questionPaperId: scheme.questionPaperId,
        },
        include: { questions: { include: { parts: true } } },
      });
      if (!paperVersion)
        throw new BadRequestException(
          'questionPaperVersionId does not belong to this scheme paper and tenant',
        );
      this.validator.validate(dto, paperVersion.questions);
      const latest = await tx.markingSchemeVersion.aggregate({
        where: { tenantId: actor.tenantId, markingSchemeId: schemeId },
        _max: { version: true },
      });
      const versionId = randomUUID();
      const ids = new Map(
        dto.items.map((item) => [item.clientKey, randomUUID()]),
      );
      const created = await tx.markingSchemeVersion.create({
        data: {
          id: versionId,
          tenantId: actor.tenantId,
          markingSchemeId: schemeId,
          questionPaperVersionId: dto.questionPaperVersionId,
          version: (latest._max.version ?? 0) + 1,
          maximumMark: new Prisma.Decimal(dto.maximumMark),
          confidenceThresholds:
            dto.confidenceThresholds as Prisma.InputJsonObject,
          createdById: actor.sub,
        },
      });
      const itemData = dto.items.map((item) => ({
        id: ids.get(item.clientKey)!,
        tenantId: actor.tenantId,
        markingSchemeVersionId: versionId,
        questionId: item.questionId,
        questionPartId: item.questionPartId,
        parentItemId: item.parentClientKey
          ? ids.get(item.parentClientKey)
          : undefined,
        groupCode: item.groupCode,
        displayOrder: item.displayOrder,
        maximumMark: new Prisma.Decimal(item.maximumMark),
        isScorable: item.isScorable ?? true,
        isRequired: item.isRequired ?? true,
      }));
      await tx.markingSchemeItem.createMany({
        data: itemData.filter((item) => !item.parentItemId),
      });
      await tx.markingSchemeItem.createMany({
        data: itemData.filter((item) => item.parentItemId),
      });
      await this.audit.record(
        tx,
        actor,
        'CREATE_VERSION',
        'markingSchemeVersion',
        versionId,
        undefined,
        { schemeId, version: created.version, maximumMark: dto.maximumMark },
      );
      return this.previewInTransaction(
        tx,
        schemeId,
        created.version,
        actor.tenantId,
      );
    });
  }

  preview(schemeId: string, version: number, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, (tx) =>
      this.previewInTransaction(tx, schemeId, version, actor.tenantId),
    );
  }

  publish(schemeId: string, version: number, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const draft = await tx.markingSchemeVersion.findFirst({
        where: { tenantId: actor.tenantId, markingSchemeId: schemeId, version },
        include: {
          items: true,
          questionPaperVersion: {
            include: { questions: { include: { parts: true } } },
          },
        },
      });
      if (!draft) throw new NotFoundException();
      if (draft.status !== VersionStatus.DRAFT)
        throw new ConflictException(
          'Only a draft scheme version can be published',
        );
      const dto: CreateMarkingSchemeVersionDto = {
        questionPaperVersionId: draft.questionPaperVersionId,
        maximumMark: draft.maximumMark.toNumber(),
        confidenceThresholds: draft.confidenceThresholds as Record<
          string,
          unknown
        >,
        items: draft.items.map((item) => ({
          clientKey: item.id,
          questionId: item.questionId!,
          questionPartId: item.questionPartId ?? undefined,
          parentClientKey: item.parentItemId ?? undefined,
          groupCode: item.groupCode,
          displayOrder: item.displayOrder,
          maximumMark: item.maximumMark.toNumber(),
          isScorable: item.isScorable,
          isRequired: item.isRequired,
        })),
      };
      this.validator.validate(dto, draft.questionPaperVersion.questions);
      const published = await tx.markingSchemeVersion.update({
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
        'markingSchemeVersion',
        draft.id,
        { status: draft.status },
        {
          status: published.status,
          maximumMark: published.maximumMark.toString(),
        },
      );
      return published;
    });
  }

  private async previewInTransaction(
    tx: Prisma.TransactionClient,
    schemeId: string,
    version: number,
    tenantId: string,
  ) {
    const result = await tx.markingSchemeVersion.findFirst({
      where: { tenantId, markingSchemeId: schemeId, version },
      include: {
        markingScheme: true,
        questionPaperVersion: { include: { questionPaper: true } },
        items: {
          include: {
            question: { select: { code: true, label: true } },
            questionPart: { select: { code: true, label: true } },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });
    if (!result) throw new NotFoundException();
    const groupTotals = result.items
      .filter((item) => !item.parentItemId && !item.questionPartId)
      .reduce<Record<string, number>>(
        (totals, item) => ({
          ...totals,
          [item.groupCode]:
            (totals[item.groupCode] ?? 0) + item.maximumMark.toNumber(),
        }),
        {},
      );
    return {
      ...result,
      calculatedMaximumMark: Object.values(groupTotals).reduce(
        (sum, value) => sum + value,
        0,
      ),
      groupTotals,
    };
  }
}
