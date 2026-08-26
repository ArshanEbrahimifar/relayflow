import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { DatabaseService } from '@app/database';
import { ExecuteWorkflowJobData, WORKFLOW_EXECUTION_QUEUE } from '@app/queue';

@Processor(WORKFLOW_EXECUTION_QUEUE)
export class WorkflowExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowExecutionProcessor.name);

  constructor(private readonly database: DatabaseService) {
    super();
  }

  async process(job: Job<ExecuteWorkflowJobData>): Promise<void> {
    const { executionId } = job.data;

    this.logger.log(`Processing execution ${executionId}`);

    await this.database.execution.update({
      where: {
        id: executionId,
      },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        error: null,
      },
    });

    try {
      // Temporary placeholder.
      // Workflow Engine will be called here in the next phase.

      this.logger.log(`Execution ${executionId} processed`);

      await this.database.execution.update({
        where: {
          id: executionId,
        },
        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      await this.database.execution.update({
        where: {
          id: executionId,
        },
        data: {
          status: 'FAILED',
          error:
            error instanceof Error ? error.message : 'Unknown execution error',
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  }
}
