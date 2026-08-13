import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AccessClaims } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { UpdateStatusDto } from '../common/dto/update-status.dto';
import { CatalogRecordDto, CsvValidationDto } from './catalog.dto';
import { CatalogService } from './catalog.service';

@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly service: CatalogService) {}
  @Post('students/import/validate')
  @RequirePermissions('master_data.manage')
  validateStudentCsv(
    @Body() dto: CsvValidationDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.validateStudentCsv(dto, actor);
  }
  @Get(':resource')
  @RequirePermissions('master_data.read')
  list(
    @Param('resource') resource: string,
    @Query() query: PageQueryDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.list(resource, query, actor);
  }
  @Post(':resource')
  @RequirePermissions('master_data.manage')
  create(
    @Param('resource') resource: string,
    @Body() dto: CatalogRecordDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.create(resource, dto, actor);
  }
  @Patch(':resource/:id')
  @RequirePermissions('master_data.manage')
  update(
    @Param('resource') resource: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CatalogRecordDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.update(resource, id, dto, actor);
  }
  @Patch(':resource/:id/status')
  @RequirePermissions('master_data.manage')
  status(
    @Param('resource') resource: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.status(resource, id, dto, actor);
  }
}
