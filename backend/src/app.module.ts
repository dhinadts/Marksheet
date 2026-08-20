import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AccessTokenGuard } from './auth/guards/access-token.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DatabaseModule } from './database/database.module';
import { TenantContextInterceptor } from './database/tenant-context.interceptor';
import { CatalogModule } from './catalog/catalog.module';
import { QuestionPapersModule } from './question-papers/question-papers.module';
import { MarkingSchemesModule } from './marking-schemes/marking-schemes.module';
import { UploadsModule } from './uploads/uploads.module';
import { MarkSheetsModule } from './mark-sheets/mark-sheets.module';
import { CalculationsModule } from './calculations/calculations.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    CatalogModule,
    QuestionPapersModule,
    MarkingSchemesModule,
    UploadsModule,
    MarkSheetsModule,
    CalculationsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
