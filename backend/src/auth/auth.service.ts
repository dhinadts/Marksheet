import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, RecordStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { AccessClaims, RequestMetadata } from './auth.types';
import { LoginDto } from './dto/login.dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly accessTtl: number;
  private readonly refreshTtl: number;
  private readonly maxFailures: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTtl = this.positiveInteger('JWT_ACCESS_TTL_SECONDS', 900);
    this.refreshTtl = this.positiveInteger('JWT_REFRESH_TTL_SECONDS', 2592000);
    this.maxFailures = this.positiveInteger('AUTH_MAX_FAILED_ATTEMPTS', 5);
  }

  private positiveInteger(key: string, fallback: number): number {
    const value = Number(this.config.get<string | number>(key, fallback));
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`${key} must be a positive integer`);
    return value;
  }

  async login(dto: LoginDto, metadata: RequestMetadata): Promise<TokenPair> {
    const username = dto.username.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { username },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    });
    const now = new Date();
    if (
      !user?.passwordHash ||
      user.status !== RecordStatus.ACTIVE ||
      (user.lockedUntil && user.lockedUntil > now)
    ) {
      if (user)
        await this.audit(
          user.tenantId,
          user.id,
          'AUTH_LOGIN_FAILED',
          'Invalid credentials',
          metadata,
        );
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      const failures = user.failedLoginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failures,
          lockedUntil:
            failures >= this.maxFailures
              ? new Date(now.getTime() + 15 * 60_000)
              : null,
        },
      });
      await this.audit(
        user.tenantId,
        user.id,
        'AUTH_LOGIN_FAILED',
        'Invalid credentials',
        metadata,
      );
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now },
    });
    const pair = await this.issuePair(user, metadata);
    await this.audit(
      user.tenantId,
      user.id,
      'AUTH_LOGIN_SUCCEEDED',
      undefined,
      metadata,
    );
    return pair;
  }

  async refresh(
    rawToken: string,
    metadata: RequestMetadata,
  ): Promise<TokenPair> {
    const hash = this.hash(rawToken);
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { tokenHash: hash },
        include: {
          user: {
            include: {
              userRoles: {
                include: {
                  role: {
                    include: {
                      rolePermissions: { include: { permission: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!session) throw new UnauthorizedException('Invalid refresh token');
      if (session.revokedAt || session.replacedById) {
        await tx.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date(), revocationReason: 'TOKEN_REUSE' },
        });
        await tx.user.update({
          where: { id: session.userId },
          data: { tokenVersion: { increment: 1 } },
        });
        await this.auditTx(
          tx,
          session.tenantId,
          session.userId,
          'AUTH_REFRESH_REUSE_DETECTED',
          undefined,
          metadata,
        );
        return null;
      }
      if (
        session.expiresAt <= new Date() ||
        session.user.status !== RecordStatus.ACTIVE
      )
        throw new UnauthorizedException('Refresh token expired');
      const nextRaw = this.newRefreshToken();
      const next = await tx.authSession.create({
        data: {
          tenantId: session.tenantId,
          userId: session.userId,
          familyId: session.familyId,
          tokenHash: this.hash(nextRaw),
          parentSessionId: session.id,
          expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
          ...metadata,
        },
      });
      await tx.authSession.update({
        where: { id: session.id },
        data: {
          replacedById: next.id,
          revokedAt: new Date(),
          revocationReason: 'ROTATED',
          lastUsedAt: new Date(),
        },
      });
      await this.auditTx(
        tx,
        session.tenantId,
        session.userId,
        'AUTH_REFRESH_SUCCEEDED',
        undefined,
        metadata,
      );
      return this.buildPair(session.user, nextRaw);
    });
    if (!result)
      throw new UnauthorizedException('Refresh token reuse detected');
    return result;
  }

  async logout(rawToken: string, metadata: RequestMetadata): Promise<void> {
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!session) return;
    await this.prisma.authSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: 'LOGOUT' },
    });
    await this.audit(
      session.tenantId,
      session.userId,
      'AUTH_LOGOUT',
      undefined,
      metadata,
    );
  }

  async currentUser(claims: AccessClaims) {
    return this.prisma.user.findFirstOrThrow({
      where: { id: claims.sub, tenantId: claims.tenantId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        displayName: true,
        status: true,
        lastLoginAt: true,
      },
    });
  }

  private async issuePair(
    user: Prisma.UserGetPayload<{
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } };
            };
          };
        };
      };
    }>,
    metadata: RequestMetadata,
  ): Promise<TokenPair> {
    const raw = this.newRefreshToken();
    await this.prisma.authSession.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        familyId: randomUUID(),
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
        ...metadata,
      },
    });
    return this.buildPair(user, raw);
  }

  private async buildPair(
    user: Prisma.UserGetPayload<{
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } };
            };
          };
        };
      };
    }>,
    refreshToken: string,
  ): Promise<TokenPair> {
    const roles = user.userRoles.map(({ role }) => role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap(({ role }) =>
          role.rolePermissions.map(({ permission }) => permission.code),
        ),
      ),
    ];
    const claims: AccessClaims = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
      tokenVersion: user.tokenVersion,
    };
    return {
      accessToken: await this.jwt.signAsync(claims, {
        expiresIn: this.accessTtl,
      }),
      refreshToken,
      expiresIn: this.accessTtl,
    };
  }

  private newRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }
  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
  private audit(
    tenantId: string,
    actorUserId: string | undefined,
    action: string,
    reason: string | undefined,
    metadata: RequestMetadata,
  ) {
    return this.prisma.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entityType: 'AUTH',
        entityId: actorUserId,
        reason,
        ...metadata,
      },
    });
  }
  private auditTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actorUserId: string,
    action: string,
    reason: string | undefined,
    metadata: RequestMetadata,
  ) {
    return tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action,
        entityType: 'AUTH',
        entityId: actorUserId,
        reason,
        ...metadata,
      },
    });
  }
}
