import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [ReportsModule, UploadsModule],
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
