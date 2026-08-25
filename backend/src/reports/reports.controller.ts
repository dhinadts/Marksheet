import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AccessClaims } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ReportQueryDto, StudentPortalDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
@RequirePermissions('report.read')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('navigation') navigation(@CurrentUser() actor: AccessClaims) {
    return this.service.navigation(actor);
  }
  @Get('summary') summary(
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.summary(query, actor);
  }
  @Get('classes') classReport(
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.classReport(query, actor);
  }
  @Get('students/:id') studentReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AccessClaims,
  ) {
    return this.service.studentReport(id, query, actor);
  }
}

@ApiTags('Student portal')
@Controller('student-portal')
export class StudentPortalController {
  constructor(private readonly service: ReportsService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('marks')
  @HttpCode(200)
  marks(@Body() dto: StudentPortalDto) {
    return this.service.studentPortal(dto);
  }
}
