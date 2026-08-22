/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarkSheetStatus } from '@prisma/client';
import type { AccessClaims } from '../auth/auth.types';
import { ReportsService } from './reports.service';

describe('ReportsService tenant isolation', () => {
  const actor: AccessClaims = {
    sub: '00000000-0000-4000-8000-000000000001',
    tenantId: '00000000-0000-4000-8000-000000000002',
    email: 'viewer@example.test',
    roles: ['viewer'],
    permissions: ['report.read'],
    tokenVersion: 1,
  };
  it('scopes summary report roots to the authenticated tenant', async () => {
    const tx = { markSheet: { findMany: jest.fn().mockResolvedValue([]) } };
    const tenant = {
      transaction: jest.fn((_prisma, callback) => callback(tx)),
    };
    const service = new ReportsService(
      {} as never,
      tenant as never,
      { get: jest.fn().mockReturnValue(10000) } as never,
    );
    await service.summary({ page: 1, pageSize: 25 }, actor);
    expect(tx.markSheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: actor.tenantId }),
      }),
    );
  });
  it('groups navigation by department and year inside the tenant', async () => {
    const tx = {
      academicClass: {
        findMany: jest.fn().mockResolvedValue([
          {
            program: {
              department: { id: 'department-1', code: 'CSE', name: 'CSE' },
            },
            studyYear: { id: 'year-1', displayName: 'I Year', ordinal: 1 },
            sections: [{ _count: { students: 42 } }],
          },
        ]),
      },
    };
    const tenant = {
      transaction: jest.fn((_prisma, callback) => callback(tx)),
    };
    const service = new ReportsService(
      {} as never,
      tenant as never,
      { get: jest.fn().mockReturnValue(10000) } as never,
    );

    await expect(service.navigation(actor)).resolves.toEqual([
      {
        id: 'department-1',
        code: 'CSE',
        name: 'CSE',
        years: [
          {
            id: 'year-1',
            name: 'I Year',
            ordinal: 1,
            students: 42,
            classes: 1,
          },
        ],
      },
    ]);
    expect(tx.academicClass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: actor.tenantId } }),
    );
  });
  it('conceals a student outside the authenticated tenant', async () => {
    const tx = { student: { findFirst: jest.fn().mockResolvedValue(null) } };
    const tenant = {
      transaction: jest.fn((_prisma, callback) => callback(tx)),
    };
    const service = new ReportsService(
      {} as never,
      tenant as never,
      { get: jest.fn().mockReturnValue(10000) } as never,
    );
    await expect(
      service.studentReport(
        '00000000-0000-4000-8000-000000000003',
        { page: 1, pageSize: 25 },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.student.findFirst).toHaveBeenCalledWith({
      where: {
        id: '00000000-0000-4000-8000-000000000003',
        tenantId: actor.tenantId,
      },
    });
  });
  it('rejects an export scope containing unverified marks', async () => {
    const tx = {
      markSheet: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: MarkSheetStatus.REVIEW_REQUIRED,
            calculationResults: [],
            verificationSessions: [],
          },
        ]),
      },
    };
    const tenant = {
      transaction: jest.fn((_prisma, callback) => callback(tx)),
    };
    const service = new ReportsService(
      {} as never,
      tenant as never,
      { get: jest.fn().mockReturnValue(10000) } as never,
    );
    await expect(
      service.exportData({ page: 1, pageSize: 25 }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
