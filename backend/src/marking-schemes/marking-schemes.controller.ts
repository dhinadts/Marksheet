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
  CreateMarkingSchemeDto,
  CreateMarkingSchemeVersionDto,
} from './marking-scheme.dto';
import { MarkingSchemesService } from './marking-schemes.service';

@ApiTags('Marking schemes')
@ApiBearerAuth()
@Controller('marking-schemes')
export class MarkingSchemesController {
  constructor(private readonly service: MarkingSchemesService) {}
  @Get() @RequirePermissions('marking_scheme.read') list(
    @Query() query: PageQueryDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.list(query, actor);
  }
  @Post() @RequirePermissions('marking_scheme.manage') create(
    @Body() dto: CreateMarkingSchemeDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.create(dto, actor);
  }
  @Post(':id/versions')
  @RequirePermissions('marking_scheme.manage')
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMarkingSchemeVersionDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.createVersion(id, dto, actor);
  }
  @Get(':id/versions/:version')
  @RequirePermissions('marking_scheme.read')
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.preview(id, version, actor);
  }
  @Post(':id/versions/:version/publish')
  @RequirePermissions('marking_scheme.manage')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.publish(id, version, actor);
  }
}
