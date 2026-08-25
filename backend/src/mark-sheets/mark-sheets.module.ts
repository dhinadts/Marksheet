import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ObjectStorageModule } from '../uploads/object-storage.module';
import { MarkSheetsController } from './mark-sheets.controller';
import { MarkSheetsService } from './mark-sheets.service';

@Module({
  imports: [AuditModule, ObjectStorageModule],
  controllers: [MarkSheetsController],
  providers: [MarkSheetsService],
  exports: [MarkSheetsService],
})
export class MarkSheetsModule {}
