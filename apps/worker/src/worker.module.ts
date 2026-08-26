import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { QueueModule } from '@app/queue';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';
import { WorkflowExecutionProcessor } from './executions/workflow-execution.processor';
import { WorkflowEngineModule } from '@app/workflow-engine';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    QueueModule,
    WorkflowEngineModule,
  ],
  providers: [WorkflowExecutionProcessor],
})
export class WorkerModule {}
