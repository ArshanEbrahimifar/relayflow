import { DatabaseService } from '@app/database';
import {
  EXECUTE_WORKFLOW_JOB,
  ExecuteWorkflowJobData,
  WORKFLOW_EXECUTION_QUEUE,
} from '@app/queue';
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

@Injectable()
export class WebhooksService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(WORKFLOW_EXECUTION_QUEUE)
    private readonly webhookExecutionQueue: Queue<ExecuteWorkflowJobData>,
  ) {}

  async receive(token: string, payload: unknown) {
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

    const execution = await this.database.execution.create({
      data: {
        userId: workflow.userId,
        workflowId: workflow.id,

        workflowVersion: workflow.version,
        workflowSnapshot: parsedDefinition.data,

        triggerType: 'WEBHOOK',
        triggerPayload: parsedPayload.data,
      },
    });

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
}
