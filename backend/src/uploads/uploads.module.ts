import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MarkSheetsModule } from '../mark-sheets/mark-sheets.module';
import { ObjectStorageModule } from './object-storage.module';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuditModule, ObjectStorageModule, MarkSheetsModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [ObjectStorageModule],
})
export class UploadsModule {}
