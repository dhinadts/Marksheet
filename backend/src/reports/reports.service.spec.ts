/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';
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
    const service = new ReportsService({} as never, tenant as never);
    await service.summary({ page: 1, pageSize: 25 }, actor);
    expect(tx.markSheet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: actor.tenantId }),
      }),
    );
  });
  it('conceals a student outside the authenticated tenant', async () => {
    const tx = { student: { findFirst: jest.fn().mockResolvedValue(null) } };
    const tenant = {
      transaction: jest.fn((_prisma, callback) => callback(tx)),
    };
    const service = new ReportsService({} as never, tenant as never);
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
});
