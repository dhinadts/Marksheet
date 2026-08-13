import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateMarkingSchemeDto {
  @IsUUID() questionPaperId!: string;
  @IsString() @MaxLength(80) code!: string;
  @IsString() @MaxLength(200) name!: string;
}

export class MarkingSchemeItemDto {
  @IsString() @MaxLength(80) clientKey!: string;
  @IsUUID() questionId!: string;
  @IsOptional() @IsUUID() questionPartId?: string;
  @IsOptional() @IsString() @MaxLength(80) parentClientKey?: string;
  @IsString() @MaxLength(50) groupCode!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maximumMark!: number;
  @IsOptional() @IsBoolean() isScorable?: boolean;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsNumber() @Min(1) displayOrder!: number;
}

export class CreateMarkingSchemeVersionDto {
  @IsUUID() questionPaperVersionId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) maximumMark!: number;
  @IsObject() confidenceThresholds!: Record<string, unknown>;
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkingSchemeItemDto)
  items!: MarkingSchemeItemDto[];
}
