import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AccessClaims } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateUploadSessionDto } from './upload.dto';
import { UploadsService } from './uploads.service';

@ApiTags('Mark-sheet uploads')
@ApiBearerAuth()
@Controller('mark-sheets')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('upload-sessions')
  @RequirePermissions('mark_sheet.upload')
  create(
    @Body() dto: CreateUploadSessionDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.uploads.create(dto, actor);
  }

  @Post(':id/upload-complete')
  @HttpCode(200)
  @RequirePermissions('mark_sheet.upload')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.uploads.complete(id, actor);
  }
}
