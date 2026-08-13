import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const service = new CatalogService({} as never, {} as never, {} as never);

  it('rejects unknown resources before touching the database', () => {
    expect(() =>
      service.list('tenants', { page: 1, pageSize: 20 }, {} as never),
    ).toThrow(NotFoundException);
  });

  it('requires the configured fields instead of inventing defaults', () => {
    expect(() =>
      service.create('universities', { code: 'U1' }, {} as never),
    ).toThrow(BadRequestException);
  });
});
