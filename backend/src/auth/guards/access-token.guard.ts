import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { RecordStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessClaims, AuthenticatedRequest } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const header = Array.isArray(authorization)
      ? authorization[0]
      : authorization;
    if (!header?.startsWith('Bearer '))
      throw new UnauthorizedException('Access token required');
    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(header.slice(7));
      const user = await this.prisma.user.findFirst({
        where: {
          id: claims.sub,
          tenantId: claims.tenantId,
          status: RecordStatus.ACTIVE,
        },
        select: { tokenVersion: true },
      });
      if (!user || user.tokenVersion !== claims.tokenVersion)
        throw new Error('revoked');
      request.user = claims;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
