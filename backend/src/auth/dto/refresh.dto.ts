import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ writeOnly: true })
  @IsString()
  @MinLength(40)
  refreshToken!: string;
}
