import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AccessClaims } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PageQueryDto } from '../common/dto/page-query.dto';
import {
  CreateQuestionPaperDto,
  CreateQuestionPaperVersionDto,
} from './question-paper.dto';
import { QuestionPapersService } from './question-papers.service';

@ApiTags('Question papers')
@ApiBearerAuth()
@Controller('question-papers')
export class QuestionPapersController {
  constructor(private readonly service: QuestionPapersService) {}
  @Get() @RequirePermissions('question_paper.read') list(
    @Query() query: PageQueryDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.list(query, actor);
  }
  @Post() @RequirePermissions('question_paper.manage') create(
    @Body() dto: CreateQuestionPaperDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.create(dto, actor);
  }
  @Post(':id/versions')
  @RequirePermissions('question_paper.manage')
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuestionPaperVersionDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.createVersion(id, dto, actor);
  }
  @Get(':id/versions/:version')
  @RequirePermissions('question_paper.read')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.preview(id, version, actor);
  }
  @Post(':id/versions/:version/publish')
  @RequirePermissions('question_paper.manage')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.publish(id, version, actor);
  }
}
