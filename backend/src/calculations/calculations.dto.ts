import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class ResolveTotalMismatchDto {
  @IsInt() @Min(1) expectedCalculationVersion!: number;
  @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}
