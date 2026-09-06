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

import { PinoLogger } from 'nestjs-pino';

import { context, propagation } from '@opentelemetry/api';

@Processor(WORKFLOW_EXECUTION_QUEUE, {
  concurrency: 5,
  limiter: {
    max: 20,
    duration: 1000,
  },
})
export class WorkflowExecutionProcessor extends WorkerHost {
  constructor(
    private readonly database: DatabaseService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(WorkflowExecutionProcessor.name);
  }

  async process(job: Job<ExecuteWorkflowJobData>): Promise<void> {
    const { executionId, traceContext } = job.data;

    const parentContext = propagation.extract(
      context.active(),
      traceContext ?? {},
    );

    return context.with(parentContext, async () => {
      const attemptNumber = job.attemptsMade + 1;

      this.logger.info(
        {
          executionId,
          attempt: attemptNumber,
          workerPid: process.pid,
        },
        'Processing workflow execution',
      );

      const execution = await this.database.execution.findUnique({
        where: {
          id: executionId,
        },
      });

      if (!execution) {
        throw new Error(`Execution ${executionId} not found`);
      }

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
          execution.userId,
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

        this.logger.info(
          {
            executionId,
            attempt: attemptNumber,
            workerPid: process.pid,
          },
          'Workflow execution succeeded',
        );
      } catch (error: unknown) {
        const normalizedError =
          error instanceof Error ? error : new Error('Unknown execution error');

        const message = normalizedError.message;

        const maxAttempts = job.opts.attempts ?? 1;

        const currentAttempt = job.attemptsMade + 1;

        const isFinalAttempt = currentAttempt >= maxAttempts;

        await this.database.execution.update({
          where: {
            id: executionId,
          },
          data: {
            status: isFinalAttempt ? 'FAILED' : 'RUNNING',

            error: message,

            finishedAt: isFinalAttempt ? new Date() : null,
          },
        });

        if (isFinalAttempt) {
          this.logger.error(
            {
              executionId,
              attempt: currentAttempt,
              maxAttempts,
              workerPid: process.pid,
              err: normalizedError,
            },
            'Workflow execution failed',
          );
        } else {
          this.logger.warn(
            {
              executionId,
              attempt: currentAttempt,
              maxAttempts,
              workerPid: process.pid,
              err: normalizedError,
            },
            'Workflow execution attempt failed; retrying',
          );
        }

        throw normalizedError;
      }
    });
  }
}
