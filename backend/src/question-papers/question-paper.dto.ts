import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

export class QuestionPartDto {
  @IsString() @MaxLength(30) code!: string;
  @IsString() @MaxLength(80) label!: string;
  @IsInt() @Min(1) displayOrder!: number;
  @IsOptional() @IsBoolean() isRequired?: boolean;
}
export class QuestionDto {
  @IsString() @MaxLength(50) code!: string;
  @IsString() @MaxLength(80) label!: string;
  @IsString() @MaxLength(50) groupCode!: string;
  @IsInt() @Min(1) displayOrder!: number;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @ValidateNested({ each: true })
  @Type(() => QuestionPartDto)
  parts!: QuestionPartDto[];
}
export class CreateQuestionPaperDto {
  @IsUUID() subjectId!: string;
  @IsString() @MaxLength(80) code!: string;
  @IsString() @MaxLength(250) title!: string;
}
export class NormalizedBoxDto {
  @IsNumber() @Min(0) @Max(0.999999) x!: number;
  @IsNumber() @Min(0) @Max(0.999999) y!: number;
  @IsNumber() @Min(0.000001) @Max(1) width!: number;
  @IsNumber() @Min(0.000001) @Max(1) height!: number;
}
export class ImageTemplateCellDto {
  @IsString() @MaxLength(50) questionCode!: string;
  @IsOptional() @IsString() @MaxLength(30) questionPartCode?: string;
  @ValidateNested() @Type(() => NormalizedBoxDto) box!: NormalizedBoxDto;
}
export class ImageTemplateDto {
  @IsNumber() @Min(0.2) @Max(5) expectedAspectRatio!: number;
  @IsNumber() @Min(0.000001) @Max(0.5) aspectRatioTolerance!: number;
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImageTemplateCellDto)
  cells!: ImageTemplateCellDto[];
}
export class CreateQuestionPaperVersionDto {
  @IsOptional() @IsString() instructions?: string;
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageTemplateDto)
  imageTemplate?: ImageTemplateDto;
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}
