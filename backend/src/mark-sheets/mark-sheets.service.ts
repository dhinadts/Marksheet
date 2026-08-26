import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MarkSheetStatus,
  MarkValueSource,
  Prisma,
  VerificationSessionStatus,
  VerificationStatus,
} from '@prisma/client';
import type { AccessClaims } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { TenantContextService } from '../database/tenant-context.service';
import { ObjectStorageService } from '../uploads/object-storage.service';
import {
  IngestExtractionDto,
  ReviewMarkDto,
  SessionMutationDto,
} from './mark-sheets.dto';
import { toQuestionWiseResult } from './question-wise-result';

@Injectable()
export class MarkSheetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
    private readonly storage: ObjectStorageService,
    private readonly config: ConfigService,
  ) {}

  async processUploaded(
    id: string,
    actor: AccessClaims,
    uploaded: { markSheetId: string; status: MarkSheetStatus },
  ) {
    const context = await this.tenant.transaction(this.prisma, async (tx) => {
      const sheet = await tx.markSheet.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: {
          images: {
            include: { fileObject: true },
            orderBy: { pageNumber: 'asc' },
          },
          questionPaperVersion: {
            include: { questions: { include: { parts: true } } },
          },
          markingSchemeVersion: {
            include: {
              items: { include: { question: true, questionPart: true } },
            },
          },
        },
      });
      if (!sheet) throw new NotFoundException();
      if (
        await tx.extractedMark.count({
          where: { tenantId: actor.tenantId, markSheetId: id },
        })
      )
        return undefined;
      if (sheet.status !== MarkSheetStatus.UPLOADED) return undefined;
      const image = sheet.images[0];
      const template = sheet.questionPaperVersion.imageTemplate as unknown as {
        expectedAspectRatio: number;
        aspectRatioTolerance: number;
        cells: Array<{
          questionCode: string;
          questionPartCode?: string;
          box: Record<string, number>;
        }>;
      } | null;
      if (!image || !template?.cells?.length)
        throw new BadRequestException(
          'Published question paper has no numeric mark-cell image template',
        );
      let model = await tx.aiModelVersion.findFirst({
        where: { tenantId: actor.tenantId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      });
      if (!model) {
        model = await tx.aiModelVersion.create({
          data: {
            tenantId: actor.tenantId,
            name: 'numeric-mark-recognizer',
            version: 'configured-v1',
            configuration: { purpose: 'handwritten numeric marks only' },
          },
        });
      }
      const items = template.cells.map((cell) => {
        const item = sheet.markingSchemeVersion.items.find(
          (candidate) =>
            candidate.isScorable &&
            candidate.question?.code === cell.questionCode &&
            (candidate.questionPart?.code ?? undefined) ===
              cell.questionPartCode,
        );
        if (!item || !item.questionId)
          throw new BadRequestException(
            `No scorable marking-scheme item matches template cell ${cell.questionCode}`,
          );
        return { cell, item };
      });
      await tx.markSheet.update({
        where: { id },
        data: {
          status: MarkSheetStatus.PROCESSING,
          columnsBeforeExtraction: items.map(({ item }) => ({
            markingSchemeItemId: item.id,
            questionId: item.questionId,
            questionPartId: item.questionPartId,
            columnName: item.questionPart
              ? `${item.question!.code}.${item.questionPart.code}`
              : item.question!.code,
            maximumMark: item.maximumMark.toString(),
            extractedValue: null,
          })),
        },
      });
      return { sheet, image, template, model, items };
    });
    if (!context) return uploaded;
    const thresholds = context.sheet.markingSchemeVersion
      .confidenceThresholds as Record<string, number>;
    const payload = {
      context: {
        tenant_id: actor.tenantId,
        mark_sheet_id: id,
        image_id: context.image.id,
        question_paper_version_id: context.sheet.questionPaperVersionId,
        marking_scheme_version_id: context.sheet.markingSchemeVersionId,
      },
      source: {
        bucket: context.image.fileObject.bucket,
        object_key: context.image.fileObject.objectKey,
        mime_type: context.image.fileObject.mimeType,
        size_bytes: Number(context.image.fileObject.sizeBytes),
        checksum_sha256: context.image.fileObject.checksumSha256,
      },
      template: {
        template_id: context.sheet.questionPaperVersionId,
        version: context.sheet.questionPaperVersion.version,
        expected_aspect_ratio: context.template.expectedAspectRatio,
        aspect_ratio_tolerance: context.template.aspectRatioTolerance,
        cells: context.items.map(({ cell, item }) => ({
          marking_scheme_item_id: item.id,
          question_id: item.questionId,
          question_part_id: item.questionPartId,
          label: item.questionPart
            ? `${item.question!.code}.${item.questionPart.code}`
            : item.question!.code,
          maximum_mark: Number(item.maximumMark),
          box: cell.box,
        })),
      },
      confidence_thresholds: {
        auto_accept: Number(
          thresholds.autoAccept ?? thresholds.auto_accept ?? 0.95,
        ),
        review_recommended: Number(
          thresholds.reviewRecommended ?? thresholds.review_recommended ?? 0.8,
        ),
        review_required: Number(
          thresholds.reviewRequired ?? thresholds.review_required ?? 0.6,
        ),
      },
      model_version_id: context.model.id,
    };
    try {
      const baseUrl =
        this.config.get<string>('AI_SERVICE_URL') ?? 'http://ai-service:8000';
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/ai/extract-marks`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-AI-Service-Key': this.config.getOrThrow<string>(
              'AI_INTERNAL_API_KEY',
            ),
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(120_000),
        },
      );
      if (!response.ok)
        throw new Error(
          `AI service returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
        );
      const result = (await response.json()) as {
        marks: Array<{
          marking_scheme_item_id: string;
          raw_text?: string | null;
          value?: number | null;
          confidence: number;
          status: string;
          bounding_box: Record<string, unknown>;
        }>;
      };
      await this.ingest(
        id,
        {
          sourceImageId: context.image.id,
          aiModelVersionId: context.model.id,
          marks: result.marks.map((mark) => ({
            markingSchemeItemId: mark.marking_scheme_item_id,
            rawText: mark.raw_text ?? undefined,
            // A review status describes confidence/validity; it must not erase
            // the recognizer's numeric result. Reviewers still need to see the
            // handwritten value in order to confirm or correct it.
            value: mark.value ?? undefined,
            confidence: mark.confidence,
            status: mark.status as never,
            boundingBox: mark.bounding_box,
          })),
        },
        actor,
      );
      return { markSheetId: id, status: MarkSheetStatus.REVIEW_REQUIRED };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'unknown AI error';
      try {
        // OCR is advisory. A provider outage or unreadable page must not leave
        // the capture in a device queue indefinitely. Persist one immutable,
        // empty extraction row per configured question so faculty can enter the
        // exact handwritten values from the stored image.
        await this.ingest(
          id,
          {
            sourceImageId: context.image.id,
            aiModelVersionId: context.model.id,
            marks: [],
          },
          actor,
        );
        await this.tenant.transaction(this.prisma, (tx) =>
          this.audit.record(
            tx,
            actor,
            'AI_EXTRACTION_FALLBACK_CREATED',
            'markSheet',
            id,
            { status: MarkSheetStatus.PROCESSING },
            {
              status: MarkSheetStatus.REVIEW_REQUIRED,
              extractionStatus: 'MANUAL_ENTRY_REQUIRED',
            },
            reason.slice(0, 500),
          ),
        );
        return {
          markSheetId: id,
          status: MarkSheetStatus.REVIEW_REQUIRED,
          extractionStatus: 'MANUAL_ENTRY_REQUIRED',
        };
      } catch (fallbackError) {
        await this.tenant.transaction(this.prisma, (tx) =>
          tx.markSheet.updateMany({
            where: {
              id,
              tenantId: actor.tenantId,
              status: MarkSheetStatus.PROCESSING,
            },
            data: { status: MarkSheetStatus.UPLOADED },
          }),
        );
        throw new ServiceUnavailableException(
          `Numeric mark extraction and manual-review fallback failed: ${fallbackError instanceof Error ? fallbackError.message : reason}`,
        );
      }
    }
  }

  ingest(id: string, dto: IngestExtractionDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const sheet = await tx.markSheet.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: {
          images: true,
          markingSchemeVersion: {
            include: {
              items: { include: { question: true, questionPart: true } },
            },
          },
        },
      });
      if (!sheet) throw new NotFoundException();
      if (
        sheet.status !== MarkSheetStatus.UPLOADED &&
        sheet.status !== MarkSheetStatus.PROCESSING
      )
        throw new ConflictException(
          'Extraction can only be ingested for an uploaded or processing mark sheet',
        );
      if (
        !sheet.images.some((image) => image.id === dto.sourceImageId) ||
        !(await tx.aiModelVersion.findFirst({
          where: { id: dto.aiModelVersionId, tenantId: actor.tenantId },
        }))
      )
        throw new BadRequestException(
          'Source image or AI model is missing or outside this tenant',
        );
      if (
        await tx.extractedMark.count({
          where: { tenantId: actor.tenantId, markSheetId: id },
        })
      )
        throw new ConflictException(
          'Extraction results already exist; history cannot be overwritten',
        );

      const supplied = new Map<string, (typeof dto.marks)[number]>();
      for (const mark of dto.marks) {
        if (supplied.has(mark.markingSchemeItemId))
          throw new BadRequestException(
            `Duplicate extraction for marking scheme item ${mark.markingSchemeItemId}`,
          );
        supplied.set(mark.markingSchemeItemId, mark);
      }
      const scorable = sheet.markingSchemeVersion.items.filter(
        (item) => item.isScorable,
      );
      const knownIds = new Set(scorable.map((item) => item.id));
      if ([...supplied.keys()].some((itemId) => !knownIds.has(itemId)))
        throw new BadRequestException(
          'Extraction contains a marking scheme item outside the selected version',
        );

      const extractedIds: string[] = [];
      for (const item of scorable) {
        const mark = supplied.get(item.id);
        const extracted = await tx.extractedMark.create({
          data: {
            tenantId: actor.tenantId,
            markSheetId: id,
            markingSchemeItemId: item.id,
            questionId: item.questionId!,
            questionPartId: item.questionPartId,
            sourceImageId: dto.sourceImageId,
            aiModelVersionId: dto.aiModelVersionId,
            rawText: mark?.rawText,
            extractedValue:
              mark?.value === undefined
                ? undefined
                : new Prisma.Decimal(mark.value),
            confidence:
              mark?.confidence === undefined
                ? undefined
                : new Prisma.Decimal(mark.confidence),
            boundingBox: mark?.boundingBox as Prisma.InputJsonObject,
            extractionStatus: mark?.status ?? 'MANUAL_ENTRY_REQUIRED',
            verificationStatus: VerificationStatus.IN_REVIEW,
            ...(mark?.value !== undefined
              ? {
                  values: {
                    create: {
                      tenantId: actor.tenantId,
                      value: new Prisma.Decimal(mark.value),
                      source: MarkValueSource.AI,
                      reason: 'Advisory AI extraction',
                    },
                  },
                }
              : {}),
          },
        });
        extractedIds.push(extracted.id);
      }
      const session = await tx.verificationSession.create({
        data: {
          tenantId: actor.tenantId,
          markSheetId: id,
          assignedToId: actor.sub,
          items: {
            create: extractedIds.map((extractedMarkId) => ({
              tenantId: actor.tenantId,
              extractedMarkId,
              status: VerificationStatus.IN_REVIEW,
            })),
          },
        },
      });
      await tx.markSheet.update({
        where: { id },
        data: {
          status: MarkSheetStatus.REVIEW_REQUIRED,
          columnsAfterExtraction: scorable.map((item) => {
            const mark = supplied.get(item.id);
            return {
              markingSchemeItemId: item.id,
              questionId: item.questionId,
              questionPartId: item.questionPartId,
              columnName: item.questionPart
                ? `${item.question!.code}.${item.questionPart.code}`
                : item.question!.code,
              maximumMark: item.maximumMark.toString(),
              rawText: mark?.rawText ?? null,
              extractedValue: mark?.value ?? null,
              confidence: mark?.confidence ?? null,
              extractionStatus: mark?.status ?? 'MANUAL_ENTRY_REQUIRED',
            };
          }),
        },
      });
      await this.audit.record(
        tx,
        actor,
        'AI_EXTRACTION_INGESTED',
        'markSheet',
        id,
        undefined,
        {
          verificationSessionId: session.id,
          extractedMarkCount: extractedIds.length,
          aiModelVersionId: dto.aiModelVersionId,
        },
      );
      return { markSheetId: id, verificationSessionId: session.id };
    });
  }

  review(id: string, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const sheet = await tx.markSheet.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: {
          student: {
            include: {
              department: { include: { college: true } },
              program: true,
              section: {
                include: {
                  class: { include: { academicYear: true, studyYear: true } },
                },
              },
            },
          },
          subjectOffering: {
            include: {
              subject: { select: { code: true, name: true } },
              academicYear: true,
            },
          },
          images: {
            include: { fileObject: true },
            orderBy: { pageNumber: 'asc' },
          },
          verificationSessions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            include: {
              items: {
                include: {
                  selectedMarkValue: true,
                  extractedMark: {
                    include: {
                      values: { orderBy: { createdAt: 'asc' } },
                      markingSchemeItem: {
                        include: { question: true, questionPart: true },
                      },
                    },
                  },
                },
              },
            },
          },
          calculationResults: {
            orderBy: { calculationVersion: 'desc' },
            take: 1,
          },
        },
      });
      if (!sheet) throw new NotFoundException();
      return {
        ...sheet,
        questionWiseResult: toQuestionWiseResult(
          sheet.verificationSessions[0]?.items ?? [],
        ),
        images: sheet.images.map((image) => ({
          id: image.id,
          pageNumber: image.pageNumber,
          url: this.storage.signDownload(image.fileObject.objectKey).url,
        })),
      };
    });
  }

  reviewItem(
    sessionId: string,
    itemId: string,
    dto: ReviewMarkDto,
    actor: AccessClaims,
  ) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const session = await tx.verificationSession.findFirst({
        where: { id: sessionId, tenantId: actor.tenantId },
      });
      if (!session) throw new NotFoundException();
      this.assertOpenAndAssigned(session, dto.expectedLockVersion, actor);
      const item = await tx.verificationItem.findFirst({
        where: {
          id: itemId,
          tenantId: actor.tenantId,
          verificationSessionId: sessionId,
        },
        include: {
          extractedMark: { include: { markingSchemeItem: true } },
        },
      });
      if (!item) throw new NotFoundException();
      const maximum = item.extractedMark.markingSchemeItem.maximumMark;
      if (dto.value < 0 || new Prisma.Decimal(dto.value).greaterThan(maximum))
        throw new BadRequestException(
          `Verified mark must be between 0 and ${maximum.toString()}`,
        );
      const value = await tx.markValue.create({
        data: {
          tenantId: actor.tenantId,
          extractedMarkId: item.extractedMarkId,
          value: new Prisma.Decimal(dto.value),
          source: MarkValueSource.REVIEWER,
          reason: dto.reason,
          createdById: actor.sub,
        },
      });
      const unchanged =
        item.extractedMark.extractedValue?.equals(value.value) ?? false;
      await tx.verificationItem.update({
        where: { id: item.id },
        data: {
          selectedMarkValueId: value.id,
          status: unchanged
            ? VerificationStatus.VERIFIED
            : VerificationStatus.CORRECTED,
          reason: dto.reason,
          reviewedAt: new Date(),
        },
      });
      await tx.extractedMark.update({
        where: { id: item.extractedMarkId },
        data: {
          verificationStatus: unchanged
            ? VerificationStatus.VERIFIED
            : VerificationStatus.CORRECTED,
        },
      });
      await tx.verificationSession.update({
        where: { id: session.id },
        data: { lockVersion: { increment: 1 } },
      });
      await this.audit.record(
        tx,
        actor,
        unchanged ? 'MARK_VERIFIED' : 'MARK_CORRECTED',
        'extractedMark',
        item.extractedMarkId,
        item.selectedMarkValueId
          ? { selectedMarkValueId: item.selectedMarkValueId }
          : undefined,
        { selectedMarkValueId: value.id, value: value.value.toString() },
        dto.reason,
      );
      return { itemId: item.id, selectedMarkValueId: value.id };
    });
  }

  submit(sessionId: string, dto: SessionMutationDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const session = await tx.verificationSession.findFirst({
        where: { id: sessionId, tenantId: actor.tenantId },
        include: { items: true },
      });
      if (!session) throw new NotFoundException();
      this.assertOpenAndAssigned(session, dto.expectedLockVersion, actor);
      if (session.items.some((item) => !item.selectedMarkValueId))
        throw new BadRequestException(
          'Every individual mark must be reviewed before submission',
        );
      const updated = await tx.verificationSession.update({
        where: { id: session.id },
        data: {
          status: VerificationSessionStatus.SUBMITTED,
          lockVersion: { increment: 1 },
        },
      });
      await this.audit.record(
        tx,
        actor,
        'VERIFICATION_SUBMITTED',
        'verificationSession',
        session.id,
        { status: session.status },
        { status: updated.status },
      );
      return updated;
    });
  }

  approve(sessionId: string, dto: SessionMutationDto, actor: AccessClaims) {
    return this.tenant.transaction(this.prisma, async (tx) => {
      const session = await tx.verificationSession.findFirst({
        where: { id: sessionId, tenantId: actor.tenantId },
        include: { items: true },
      });
      if (!session) throw new NotFoundException();
      if (
        session.status !== VerificationSessionStatus.SUBMITTED ||
        session.lockVersion !== dto.expectedLockVersion
      )
        throw new ConflictException(
          'Verification session changed or is not submitted',
        );
      if (session.items.some((item) => !item.selectedMarkValueId))
        throw new BadRequestException('Submitted session is incomplete');
      await tx.verificationItem.updateMany({
        where: { tenantId: actor.tenantId, verificationSessionId: session.id },
        data: { status: VerificationStatus.VERIFIED },
      });
      await tx.extractedMark.updateMany({
        where: { tenantId: actor.tenantId, markSheetId: session.markSheetId },
        data: { verificationStatus: VerificationStatus.VERIFIED },
      });
      const updated = await tx.verificationSession.update({
        where: { id: session.id },
        data: {
          status: VerificationSessionStatus.APPROVED,
          completedById: actor.sub,
          completedAt: new Date(),
          lockVersion: { increment: 1 },
        },
      });
      await tx.markSheet.update({
        where: { id: session.markSheetId },
        data: { status: MarkSheetStatus.VERIFIED },
      });
      await this.audit.record(
        tx,
        actor,
        'VERIFICATION_APPROVED',
        'verificationSession',
        session.id,
        { status: session.status },
        { status: updated.status },
      );
      return updated;
    });
  }

  private assertOpenAndAssigned(
    session: {
      status: VerificationSessionStatus;
      lockVersion: number;
      assignedToId: string | null;
    },
    expectedLockVersion: number,
    actor: AccessClaims,
  ): void {
    if (
      session.status !== VerificationSessionStatus.OPEN ||
      session.lockVersion !== expectedLockVersion
    )
      throw new ConflictException(
        'Verification session changed or is not open',
      );
    if (
      session.assignedToId &&
      session.assignedToId !== actor.sub &&
      !actor.permissions.includes('mark.verify')
    )
      throw new ForbiddenException(
        'Verification session is assigned to another reviewer',
      );
  }
}
