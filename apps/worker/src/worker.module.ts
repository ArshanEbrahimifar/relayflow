import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { QueueModule } from '@app/queue';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { WorkflowExecutionProcessor } from './executions/workflow-execution.processor';

@Module({
  imports: [AppConfigModule, DatabaseModule, RedisModule, QueueModule],
  providers: [WorkflowExecutionProcessor],
})
export class WorkerModule {}
