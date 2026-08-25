import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import type {
  AccessClaims,
  AuthenticatedRequest,
  RequestMetadata,
} from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() request: AuthenticatedRequest) {
    return this.auth.login(dto, this.metadata(request));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() request: AuthenticatedRequest) {
    return this.auth.refresh(dto.refreshToken, this.metadata(request));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Body() dto: RefreshDto, @Req() request: AuthenticatedRequest) {
    return this.auth.logout(dto.refreshToken, this.metadata(request));
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AccessClaims) {
    return this.auth.currentUser(user);
  }

  @ApiBearerAuth()
  @Get('me/students')
  myStudents(@CurrentUser() user: AccessClaims) {
    return this.auth.myDepartmentStudents(user);
  }

  private metadata(request: AuthenticatedRequest): RequestMetadata {
    const raw = request.headers['user-agent'];
    return {
      ipAddress: request.ip,
      userAgent: Array.isArray(raw) ? raw[0] : raw,
    };
  }
}
