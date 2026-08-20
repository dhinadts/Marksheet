import { ExtractionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AiExtractedMarkDto {
  @IsUUID() markingSchemeItemId!: string;
  @IsOptional() @IsString() @MaxLength(100) rawText?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) value?: number;
  @IsNumber() @Min(0) @Max(1) confidence!: number;
  @IsEnum(ExtractionStatus) status!: ExtractionStatus;
  @IsObject() boundingBox!: Record<string, unknown>;
}

export class IngestExtractionDto {
  @IsUUID() sourceImageId!: string;
  @IsUUID() aiModelVersionId!: string;
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AiExtractedMarkDto)
  marks!: AiExtractedMarkDto[];
}

export class ReviewMarkDto {
  @IsNumber({ maxDecimalPlaces: 2 }) value!: number;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @IsInt() @Min(0) expectedLockVersion!: number;
}

export class SessionMutationDto {
  @IsInt() @Min(0) expectedLockVersion!: number;
}
