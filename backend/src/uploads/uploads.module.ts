import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ObjectStorageService } from './object-storage.service';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuditModule],
  controllers: [UploadsController],
  providers: [UploadsService, ObjectStorageService],
  exports: [ObjectStorageService],
})
export class UploadsModule {}
