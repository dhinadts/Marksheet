import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AccessClaims } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateExportDto } from './exports.dto';
import { ExportsService } from './exports.service';

@ApiTags('Exports')
@ApiBearerAuth()
@Controller('exports')
export class ExportsController {
  constructor(private readonly service: ExportsService) {}
  @Post() @RequirePermissions('export.create') create(
    @Body() dto: CreateExportDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.create(dto, actor);
  }
  @Get(':id') @RequirePermissions('export.create') get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.get(id, actor);
  }
}
