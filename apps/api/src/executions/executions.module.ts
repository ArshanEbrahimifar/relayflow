import { Module } from '@nestjs/common';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { DatabaseModule } from '@app/database';
import { AuthModule } from '../auth/auth.module';
import { ExecutionHistoryController } from './execution-history.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ExecutionsController, ExecutionHistoryController],
  providers: [ExecutionsService],
})
export class ExecutionsModule {}
