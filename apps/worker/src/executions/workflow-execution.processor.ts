import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';

import type { Job } from 'bullmq';

import { DatabaseService } from '@app/database';

import {
  type ExecuteWorkflowJobData,
  WORKFLOW_EXECUTION_QUEUE,
} from '@app/queue';

import {
  WorkflowEngineService,
  workflowDataSchema,
  workflowDefinitionSchema,
} from '@app/workflow-engine';

@Processor(WORKFLOW_EXECUTION_QUEUE)
export class WorkflowExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkflowExecutionProcessor.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {
    super();
  }

  async process(job: Job<ExecuteWorkflowJobData>): Promise<void> {
    const { executionId } = job.data;

    const attemptNumber = job.attemptsMade + 1;

    const execution = await this.database.execution.findUnique({
      where: {
        id: executionId,
      },
    });

    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    this.logger.log(
      `Processing execution ${executionId}, attempt ${attemptNumber}`,
    );

    await this.database.execution.update({
      where: {
        id: executionId,
      },

      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        finishedAt: null,
        error: null,
      },
    });

    try {
      const parsedDefinition = workflowDefinitionSchema.safeParse(
        execution.workflowSnapshot,
      );

      if (!parsedDefinition.success) {
        throw new Error('Execution workflow snapshot is invalid');
      }

      const parsedTriggerPayload = workflowDataSchema.safeParse(
        execution.triggerPayload,
      );

      if (!parsedTriggerPayload.success) {
        throw new Error('Execution trigger payload is invalid');
      }

      await this.workflowEngine.execute(
        execution.id,
        parsedDefinition.data,
        parsedTriggerPayload.data,
      );

      await this.database.execution.update({
        where: {
          id: executionId,
        },

        data: {
          status: 'SUCCEEDED',
          finishedAt: new Date(),
        },
      });

      this.logger.log(`Execution ${executionId} succeeded`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown execution error';
      const maxAttempts = job.opts.attempts ?? 1;

      const currentAttempt = job.attemptsMade + 1;

      const isFinalAttempt = currentAttempt >= maxAttempts;

      await this.database.execution.update({
        where: {
          id: executionId,
        },

        data: {
          ...(isFinalAttempt ? { status: 'FAILED' } : { status: 'RUNNING' }),
          error: message,
          ...(isFinalAttempt
            ? { finishedAt: new Date() }
            : { finishedAt: null }),
        },
      });

      if (isFinalAttempt) {
        this.logger.error(
          `Execution ${executionId} failed after ${currentAttempt} attempts: ${message}`,
        );
      } else {
        this.logger.warn(
          `Execution ${executionId} attempt ${currentAttempt} failed, retrying: ${message}`,
        );
      }

      throw error;
    }
  }
}
