import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MarkingSchemesController } from './marking-schemes.controller';
import { MarkingSchemesService } from './marking-schemes.service';
import { MarkingSchemeValidator } from './marking-scheme-validator';
@Module({
  imports: [AuditModule],
  controllers: [MarkingSchemesController],
  providers: [MarkingSchemesService, MarkingSchemeValidator],
})
export class MarkingSchemesModule {}
