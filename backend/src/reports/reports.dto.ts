import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ReportQueryDto {
  @IsOptional() @IsUUID() universityId?: string;
  @IsOptional() @IsUUID() collegeId?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() programId?: string;
  @IsOptional() @IsUUID() academicYearId?: string;
  @IsOptional() @IsUUID() studyYearId?: string;
  @IsOptional() @IsUUID() semesterId?: string;
  @IsOptional() @IsUUID() classId?: string;
  @IsOptional() @IsUUID() sectionId?: string;
  @IsOptional() @IsUUID() subjectId?: string;
  @IsOptional() @IsUUID() subjectOfferingId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page =
    1;
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
