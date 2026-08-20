import { ExportFormat } from '@prisma/client';
import { IsEnum } from 'class-validator';
import { ReportQueryDto } from '../reports/reports.dto';

export class CreateExportDto extends ReportQueryDto {
  @IsEnum(ExportFormat) format!: ExportFormat;
}
