import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CalculationStatus,
  MarkSheetStatus,
  Prisma,
  VerificationSessionStatus,
} from '@prisma/client';
import type { AccessClaims } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { calculateMarks } from './calculation-engine';
import { ResolveTotalMismatchDto } from './calculations.dto';

@Injectable()
export class CalculationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  calculate(markSheetId: string, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const sheet = await tx.markSheet.findFirst({
        where: { id: markSheetId, tenantId: actor.tenantId },
        include: {
          markingSchemeVersion: { include: { items: true } },
          verificationSessions: {
            where: { status: VerificationSessionStatus.APPROVED },
            orderBy: { completedAt: 'desc' },
            take: 1,
            include: {
              items: {
                include: {
                  selectedMarkValue: true,
                  extractedMark: true,
                },
              },
            },
          },
        },
      });
      if (!sheet) throw new NotFoundException();
      const session = sheet.verificationSessions[0];
      if (!session)
        throw new BadRequestException(
          'An approved verification session is required before calculation',
        );
      const selectedBySchemeItem = new Map(
        session.items.map((item) => [
          item.extractedMark.markingSchemeItemId,
          item.selectedMarkValue,
        ]),
      );
      const result = calculateMarks(
        sheet.markingSchemeVersion.items
          .filter((item) => item.isScorable)
          .map((item) => {
            const selected = selectedBySchemeItem.get(item.id);
            return {
              id: item.id,
              groupCode: item.groupCode,
              maximumMark: item.maximumMark,
              isRequired: item.isRequired,
              selectedMarkValueId: selected?.id,
              value: selected?.value,
            };
          }),
        sheet.markingSchemeVersion.maximumMark,
        sheet.handwrittenTotal,
      );
      const latest = await tx.calculationResult.findFirst({
        where: { tenantId: actor.tenantId, markSheetId },
        orderBy: { calculationVersion: 'desc' },
      });
      if (latest?.inputDigest === result.inputDigest) return latest;
      const created = await tx.calculationResult.create({
        data: {
          tenantId: actor.tenantId,
          markSheetId,
          calculationVersion: (latest?.calculationVersion ?? 0) + 1,
          groupTotals: result.groupTotals,
          grandTotal: result.grandTotal,
          maximumMark: result.maximumMark,
          percentage: result.percentage,
          handwrittenTotal: result.handwrittenTotal,
          status: result.status,
          inputDigest: result.inputDigest,
        },
      });
      await tx.markSheet.update({
        where: { id: markSheetId },
        data: {
          status:
            result.status === CalculationStatus.READY_FOR_EXPORT
              ? MarkSheetStatus.COMPLETED
              : MarkSheetStatus.REVIEW_REQUIRED,
        },
      });
      await this.audit.record(
        tx,
        actor,
        'CALCULATION_CREATED',
        'calculationResult',
        created.id,
        undefined,
        {
          version: created.calculationVersion,
          status: created.status,
          grandTotal: created.grandTotal.toString(),
        },
      );
      return created;
    });
  }

  latest(markSheetId: string, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const sheet = await tx.markSheet.findFirst({
        where: { id: markSheetId, tenantId: actor.tenantId },
        select: { id: true },
      });
      if (!sheet) throw new NotFoundException();
      const result = await tx.calculationResult.findFirst({
        where: { tenantId: actor.tenantId, markSheetId },
        orderBy: { calculationVersion: 'desc' },
      });
      if (!result) throw new NotFoundException();
      return result;
    });
  }

  resolve(id: string, dto: ResolveTotalMismatchDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const current = await tx.calculationResult.findFirst({
        where: { id, tenantId: actor.tenantId },
      });
      if (!current) throw new NotFoundException();
      const latest = await tx.calculationResult.findFirst({
        where: { tenantId: actor.tenantId, markSheetId: current.markSheetId },
        orderBy: { calculationVersion: 'desc' },
      });
      if (
        current.status !== CalculationStatus.TOTAL_MISMATCH ||
        latest?.id !== current.id ||
        current.calculationVersion !== dto.expectedCalculationVersion
      )
        throw new ConflictException(
          'Only the latest matching total-mismatch version can be resolved',
        );
      const resolved = await tx.calculationResult.create({
        data: {
          tenantId: actor.tenantId,
          markSheetId: current.markSheetId,
          calculationVersion: current.calculationVersion + 1,
          groupTotals: current.groupTotals as Prisma.InputJsonValue,
          grandTotal: current.grandTotal,
          maximumMark: current.maximumMark,
          percentage: current.percentage,
          handwrittenTotal: current.handwrittenTotal,
          status: CalculationStatus.READY_FOR_EXPORT,
          inputDigest: current.inputDigest,
        },
      });
      await tx.markSheet.update({
        where: { id: current.markSheetId },
        data: { status: MarkSheetStatus.COMPLETED },
      });
      await this.audit.record(
        tx,
        actor,
        'TOTAL_MISMATCH_RESOLVED',
        'calculationResult',
        resolved.id,
        { previousCalculationId: current.id, status: current.status },
        { status: resolved.status },
        dto.reason,
      );
      return resolved;
    });
  }
}
