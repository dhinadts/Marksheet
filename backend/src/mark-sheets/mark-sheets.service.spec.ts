/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion */
import { BadRequestException } from '@nestjs/common';
import {
  MarkValueSource,
  Prisma,
  VerificationSessionStatus,
} from '@prisma/client';
import { MarkSheetsService } from './mark-sheets.service';
import type { AccessClaims } from '../auth/auth.types';

describe('MarkSheetsService', () => {
  const actor: AccessClaims = {
    sub: '00000000-0000-4000-8000-000000000001',
    tenantId: '00000000-0000-4000-8000-000000000002',
    permissions: ['mark.review'],
    email: 'reviewer@example.test',
    roles: ['reviewer'],
    tokenVersion: 1,
  };

  afterEach(() => jest.restoreAllMocks());

  it('creates systemized manual-review entries when OCR is unavailable', async () => {
    const item = {
      id: 'item-id',
      questionId: 'question-id',
      questionPartId: null,
      isScorable: true,
      maximumMark: new Prisma.Decimal(2),
      question: { code: 'Q1' },
      questionPart: null,
    };
    const tx = {
      markSheet: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'sheet-id',
          status: 'UPLOADED',
          questionPaperVersionId: 'paper-id',
          markingSchemeVersionId: 'scheme-id',
          images: [
            {
              id: 'image-id',
              fileObject: {
                bucket: 'private-bucket',
                objectKey: `${actor.tenantId}/sheet.jpg`,
                mimeType: 'image/jpeg',
                sizeBytes: 1024n,
                checksumSha256: 'a'.repeat(64),
              },
            },
          ],
          questionPaperVersion: {
            version: 1,
            imageTemplate: {
              expectedAspectRatio: 0.7,
              aspectRatioTolerance: 0.2,
              cells: [{ questionCode: 'Q1', box: { x: 0.1 } }],
            },
          },
          markingSchemeVersion: {
            confidenceThresholds: {
              autoAccept: 0.95,
              reviewRecommended: 0.8,
              reviewRequired: 0.6,
            },
            items: [item],
          },
        }),
        update: jest.fn(),
      },
      extractedMark: { count: jest.fn().mockResolvedValue(0) },
      aiModelVersion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'model-id' }),
      },
    };
    const tenant = {
      transaction: jest.fn((_prisma, callback) => callback(tx)),
    };
    const audit = { record: jest.fn() };
    const config = {
      get: jest.fn().mockReturnValue('http://ai-service:8000'),
      getOrThrow: jest.fn().mockReturnValue('internal-key'),
    };
    const service = new MarkSheetsService(
      {} as never,
      tenant as never,
      audit as never,
      {} as never,
      config as never,
    );
    const ingest = jest
      .spyOn(service, 'ingest')
      .mockResolvedValue({ markSheetId: 'sheet-id' } as never);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('quota unavailable'),
    } as Response);

    await expect(
      service.processUploaded('sheet-id', actor, {
        markSheetId: 'sheet-id',
        status: 'UPLOADED' as never,
      }),
    ).resolves.toEqual({
      markSheetId: 'sheet-id',
      status: 'REVIEW_REQUIRED',
      extractionStatus: 'MANUAL_ENTRY_REQUIRED',
    });
    expect(ingest).toHaveBeenCalledWith(
      'sheet-id',
      expect.objectContaining({
        sourceImageId: 'image-id',
        aiModelVersionId: 'model-id',
        marks: [],
      }),
      actor,
    );
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      actor,
      'AI_EXTRACTION_FALLBACK_CREATED',
      'markSheet',
      'sheet-id',
      expect.anything(),
      expect.objectContaining({ extractionStatus: 'MANUAL_ENTRY_REQUIRED' }),
      expect.stringContaining('503'),
    );
  });

  it('appends a reviewer value and never overwrites the AI value', async () => {
    const tx = {
      verificationSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session',
          status: VerificationSessionStatus.OPEN,
          lockVersion: 0,
          assignedToId: actor.sub,
        }),
        update: jest.fn(),
      },
      verificationItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item',
          extractedMarkId: 'extracted',
          selectedMarkValueId: 'old-ai-value',
          extractedMark: {
            extractedValue: new Prisma.Decimal(1),
            markingSchemeItem: { maximumMark: new Prisma.Decimal(2) },
          },
        }),
        update: jest.fn(),
      },
      markValue: {
        create: jest.fn().mockResolvedValue({
          id: 'review-value',
          value: new Prisma.Decimal(2),
        }),
      },
      extractedMark: { update: jest.fn() },
    };
    const tenant = {
      transaction: jest.fn((_prisma, callback) => callback(tx)),
    };
    const audit = { record: jest.fn() };
    const service = new MarkSheetsService(
      {} as never,
      tenant as never,
      audit as never,
      {} as never,
      {} as never,
    );

    await service.reviewItem(
      'session',
      'item',
      {
        value: 2,
        reason: 'Corrected after visual review',
        expectedLockVersion: 0,
      },
      actor,
    );

    expect(tx.markValue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: MarkValueSource.REVIEWER,
          value: new Prisma.Decimal(2),
        }),
      }),
    );
    expect(tx.verificationItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ selectedMarkValueId: 'review-value' }),
      }),
    );
  });

  it('rejects a reviewed value above the configured item maximum', async () => {
    const tx = {
      verificationSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session',
          status: VerificationSessionStatus.OPEN,
          lockVersion: 0,
          assignedToId: actor.sub,
        }),
      },
      verificationItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item',
          extractedMarkId: 'extracted',
          extractedMark: {
            extractedValue: new Prisma.Decimal(1),
            markingSchemeItem: { maximumMark: new Prisma.Decimal(2) },
          },
        }),
      },
      markValue: { create: jest.fn() },
    };
    const tenant = {
      transaction: jest.fn((_prisma, callback) => callback(tx)),
    };
    const service = new MarkSheetsService(
      {} as never,
      tenant as never,
      { record: jest.fn() } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.reviewItem(
        'session',
        'item',
        { value: 3, reason: 'Visual confirmation', expectedLockVersion: 0 },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.markValue.create).not.toHaveBeenCalled();
  });
});
