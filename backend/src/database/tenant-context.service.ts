import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<string>();

  run<T>(tenantId: string, callback: () => T): T {
    return this.storage.run(tenantId, callback);
  }

  get tenantId(): string | undefined {
    return this.storage.getStore();
  }

  async transaction<T>(
    prisma: PrismaService,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const tenantId = this.tenantId;
    if (!tenantId) throw new Error('Authenticated tenant context is required');
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return callback(tx);
    });
  }
}
