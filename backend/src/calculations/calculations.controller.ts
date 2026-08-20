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
import { ResolveTotalMismatchDto } from './calculations.dto';
import { CalculationsService } from './calculations.service';

@ApiTags('Calculations')
@ApiBearerAuth()
@Controller()
export class CalculationsController {
  constructor(private readonly service: CalculationsService) {}

  @Post('mark-sheets/:id/calculations')
  @RequirePermissions('mark.verify')
  calculate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.calculate(id, actor);
  }

  @Get('mark-sheets/:id/calculations/latest')
  @RequirePermissions('mark_sheet.read')
  latest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.latest(id, actor);
  }

  @Post('calculations/:id/resolve-total-mismatch')
  @RequirePermissions('mark.verify')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveTotalMismatchDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.resolve(id, dto, actor);
  }
}
