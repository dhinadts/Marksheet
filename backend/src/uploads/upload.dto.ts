import { IsIn, IsInt, IsUUID, Matches, Max, Min } from 'class-validator';

export class CreateUploadSessionDto {
  @IsUUID() clientRequestId!: string;
  @IsUUID() studentId!: string;
  @IsUUID() subjectOfferingId!: string;
  @IsUUID() questionPaperVersionId!: string;
  @IsUUID() markingSchemeVersionId!: string;
  @IsInt() @Min(1) attempt!: number;
  @IsInt() @Min(1) @Max(20) pageNumber!: number;
  @IsIn(['image/jpeg', 'image/png', 'image/heic']) mimeType!: string;
  @IsInt() @Min(1024) @Max(25 * 1024 * 1024) sizeBytes!: number;
  @Matches(/^[a-fA-F0-9]{64}$/) checksumSha256!: string;
}
