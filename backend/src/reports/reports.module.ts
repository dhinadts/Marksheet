import { Module } from '@nestjs/common';
import {
  ReportsController,
  StudentPortalController,
} from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController, StudentPortalController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
