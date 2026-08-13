import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AccessClaims } from '../auth/auth.types';

type AuditClient = Pick<PrismaClient, 'auditLog'> | Prisma.TransactionClient;
@Injectable()
export class AuditService {
  record(
    client: AuditClient,
    actor: AccessClaims,
    action: string,
    entityType: string,
    entityId: string,
    oldValues?: Prisma.InputJsonValue,
    newValues?: Prisma.InputJsonValue,
    reason?: string,
  ) {
    return client.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.sub,
        action,
        entityType,
        entityId,
        oldValues,
        newValues,
        reason,
      },
    });
  }
}
