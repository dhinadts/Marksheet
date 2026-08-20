import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AccessClaims } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import {
  IngestExtractionDto,
  ReviewMarkDto,
  SessionMutationDto,
} from './mark-sheets.dto';
import { MarkSheetsService } from './mark-sheets.service';

@ApiTags('Mark-sheet review')
@ApiBearerAuth()
@Controller()
export class MarkSheetsController {
  constructor(private readonly service: MarkSheetsService) {}

  @Post('mark-sheets/:id/extractions')
  @RequirePermissions('mark.review')
  ingest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IngestExtractionDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.ingest(id, dto, actor);
  }

  @Get('mark-sheets/:id/review')
  @RequirePermissions('mark_sheet.read')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.review(id, actor);
  }

  @Patch('verification-sessions/:sessionId/items/:itemId')
  @RequirePermissions('mark.review')
  reviewItem(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ReviewMarkDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.reviewItem(sessionId, itemId, dto, actor);
  }

  @Post('verification-sessions/:id/submit')
  @RequirePermissions('mark.review')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SessionMutationDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.submit(id, dto, actor);
  }

  @Post('verification-sessions/:id/approve')
  @RequirePermissions('mark.verify')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SessionMutationDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.approve(id, dto, actor);
  }
}
