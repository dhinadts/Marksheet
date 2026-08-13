import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedRequest } from '../auth.types';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (!required.length) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (
      !required.every((permission) =>
        request.user.permissions.includes(permission),
      )
    ) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: request.user.tenantId,
          actorUserId: request.user.sub,
          action: 'AUTHORIZATION_DENIED',
          entityType: 'PERMISSION',
          reason: `Required permissions: ${required.join(', ')}`,
        },
      });
      throw new ForbiddenException('Insufficient permission');
    }
    return true;
  }
}
