import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
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
export class CreateQuestionPaperVersionDto {
  @IsOptional() @IsString() instructions?: string;
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}
