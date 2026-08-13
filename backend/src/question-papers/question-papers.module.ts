import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { QuestionPapersController } from './question-papers.controller';
import { QuestionPapersService } from './question-papers.service';
@Module({
  imports: [AuditModule],
  controllers: [QuestionPapersController],
  providers: [QuestionPapersService],
})
export class QuestionPapersModule {}
