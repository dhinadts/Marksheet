import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const prisma = { auditLog: { create: jest.fn() } };

  it('allows requests containing every required permission', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['mark.verify']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector, prisma as never);
    const context = contextWith(['mark.verify']);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects and audits missing permissions', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['mark.verify']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector, prisma as never);
    await expect(
      guard.canActivate(contextWith(['mark.review'])),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

function contextWith(permissions: string[]): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          permissions,
          tenantId: '00000000-0000-4000-8000-000000000001',
          sub: '00000000-0000-4000-8000-000000000002',
        },
      }),
    }),
  } as unknown as ExecutionContext;
}
