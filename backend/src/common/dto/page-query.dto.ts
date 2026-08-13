import { ApiPropertyOptional } from '@nestjs/swagger';
import { RecordStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;
  @ApiPropertyOptional({ default: 25, maximum: 100 })
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 25;
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsEnum(RecordStatus)
  @IsOptional()
  status?: RecordStatus;
}

export interface PageResult<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}
export const pageResult = <T>(
  data: T[],
  total: number,
  query: PageQueryDto,
): PageResult<T> => ({
  data,
  meta: {
    page: query.page,
    pageSize: query.pageSize,
    total,
    pageCount: Math.ceil(total / query.pageSize),
  },
});
