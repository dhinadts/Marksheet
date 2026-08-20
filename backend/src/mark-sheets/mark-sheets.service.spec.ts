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
