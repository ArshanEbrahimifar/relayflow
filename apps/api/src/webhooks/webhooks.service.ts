import { DatabaseService } from '@app/database';
import {
  EXECUTE_WORKFLOW_JOB,
  ExecuteWorkflowJobData,
  QueueCapacityService,
  WORKFLOW_EXECUTION_QUEUE,
} from '@app/queue';
import { RateLimitService } from '@app/rate-limit';
import {
  workflowDataSchema,
  workflowDefinitionSchema,
} from '@app/workflow-engine';
import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { WebhookRateLimitException } from './exceptions/webhook-rate-limit.exception';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(WORKFLOW_EXECUTION_QUEUE)
    private readonly webhookExecutionQueue: Queue<ExecuteWorkflowJobData>,
    private readonly rateLimit: RateLimitService,
    private readonly queueCapacity: QueueCapacityService,
  ) {}

  async receive(token: string, payload: unknown, idempotencyKey?: string) {
    const workflow = await this.database.workflow.findUnique({
      where: {
        webhookToken: token,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        definition: true,
        version: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow does not exist');
    }

    const rateLimitResult = await this.rateLimit.consume(
      `rate-limit:webhook:${workflow.id}`,
      60,
      60,
    );

    if (!rateLimitResult.allowed) {
      throw new WebhookRateLimitException(rateLimitResult.retryAfterSeconds);
    }

    const parsedDefinition = workflowDefinitionSchema.safeParse(
      workflow.definition,
    );

    if (!parsedDefinition.success) {
      throw new BadRequestException('Invalid workflow definition');
    }

    if (
      workflow.status !== 'ACTIVE' ||
      parsedDefinition.data.trigger.type !== 'WEBHOOK'
    ) {
      throw new BadRequestException('Webhook workflow is not active');
    }

    const parsedPayload = workflowDataSchema.safeParse(payload ?? {});

    if (!parsedPayload.success) {
      throw new BadRequestException('Invalid webhook payload');
    }

    const normalizedIdempotencyKey = idempotencyKey?.trim() || undefined;

    if (normalizedIdempotencyKey) {
      const existingExecution = await this.database.execution.findUnique({
        where: {
          workflowId_idempotencyKey: {
            workflowId: workflow.id,
            idempotencyKey: normalizedIdempotencyKey,
          },
        },
      });

      if (existingExecution) {
        return existingExecution;
      }
    }
    const hasCapacity = await this.queueCapacity.hasCapacity();

    if (!hasCapacity) {
      throw new ServiceUnavailableException(
        'Workflow execution queue is at capacity',
      );
    }

    let execution;

    try {
      execution = await this.database.execution.create({
        data: {
          userId: workflow.userId,

          workflowId: workflow.id,
          workflowVersion: workflow.version,
          workflowSnapshot: parsedDefinition.data,

          triggerType: 'WEBHOOK',
          triggerPayload: parsedPayload.data,

          idempotencyKey: normalizedIdempotencyKey,
        },
      });
    } catch (error) {
      if (normalizedIdempotencyKey && this.isUniqueConstraintError(error)) {
        const existingExecution = await this.database.execution.findUnique({
          where: {
            workflowId_idempotencyKey: {
              workflowId: workflow.id,
              idempotencyKey: normalizedIdempotencyKey,
            },
          },
        });

        if (existingExecution) {
          return existingExecution;
        }
      }

      throw error;
    }

    try {
      await this.webhookExecutionQueue.add(EXECUTE_WORKFLOW_JOB, {
        executionId: execution.id,
      });
    } catch {
      await this.database.execution.update({
        where: {
          id: execution.id,
        },
        data: {
          status: 'FAILED',
          error: 'Failed to enqueue execution',
          finishedAt: new Date(),
        },
      });

      throw new ServiceUnavailableException(
        'Unable to queue workflow execution',
      );
    }

    return execution;
  }

  private isUniqueConstraintError(error: unknown): error is { code: string } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
