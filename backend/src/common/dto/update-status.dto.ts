import { ApiProperty } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { IsDateString, IsEnum } from 'class-validator';

export class UpdateStatusDto {
  @ApiProperty({ enum: RecordStatus })
  @IsEnum(RecordStatus)
  status!: RecordStatus;
  @ApiProperty() @IsDateString() expectedUpdatedAt!: string;
}
