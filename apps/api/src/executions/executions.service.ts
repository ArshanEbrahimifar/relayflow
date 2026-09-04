import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { DatabaseService } from '@app/database';

import { RunWorkflowDto } from './dto/run-workflow.dto';
import { executionInputSchema } from './schemas/execution-input.schema';

import type { Queue } from 'bullmq';

import { workflowDefinitionSchema } from '@app/workflow-engine';
import { InjectQueue } from '@nestjs/bullmq';
import {
  EXECUTE_WORKFLOW_JOB,
  type ExecuteWorkflowJobData,
  QueueCapacityService,
  WORKFLOW_EXECUTION_QUEUE,
} from '@app/queue';

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly database: DatabaseService,
    @InjectQueue(WORKFLOW_EXECUTION_QUEUE)
    private readonly executionQueue: Queue<ExecuteWorkflowJobData>,
    private readonly queueCapacity: QueueCapacityService,
  ) {}

  async runManual(userId: string, workflowId: string, dto: RunWorkflowDto) {
    const workflow = await this.database.workflow.findFirst({
      where: {
        id: workflowId,
        userId,
      },
      select: {
        id: true,
        status: true,
        version: true,
        definition: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    if (workflow.status !== 'ACTIVE') {
      throw new BadRequestException('Only active workflows can be run');
    }

    const parsedDefinition = workflowDefinitionSchema.safeParse(
      workflow.definition,
    );

    if (!parsedDefinition.success) {
      throw new BadRequestException('Workflow definition is invalid');
    }

    if (parsedDefinition.data.trigger.type !== 'MANUAL') {
      throw new BadRequestException('Workflow does not use a manual trigger');
    }

    const parsedInput = executionInputSchema.safeParse(dto.input ?? {});

    if (!parsedInput.success) {
      throw new BadRequestException('Invalid execution input');
    }
    const hasCapacity = await this.queueCapacity.hasCapacity();

    if (!hasCapacity) {
      throw new ServiceUnavailableException(
        'Workflow execution queue is at capacity',
      );
    }
    const execution = await this.database.execution.create({
      data: {
        workflowId: workflow.id,
        userId,

        workflowVersion: workflow.version,
        workflowSnapshot: parsedDefinition.data,

        triggerType: 'MANUAL',
        triggerPayload: parsedInput.data,
      },

      select: {
        id: true,
        workflowId: true,
        workflowVersion: true,
        triggerType: true,
        status: true,
        createdAt: true,
      },
    });

    try {
      await this.executionQueue.add(EXECUTE_WORKFLOW_JOB, {
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

  async findAll(userId: string) {
    return this.database.execution.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        workflowId: true,
        workflowVersion: true,
        triggerType: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,

        workflow: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(userId: string, executionId: string) {
    const execution = await this.database.execution.findFirst({
      where: {
        id: executionId,
        userId,
      },
      select: {
        id: true,
        workflowId: true,
        workflowVersion: true,

        workflowSnapshot: true,

        triggerType: true,
        triggerPayload: true,

        status: true,

        error: true,
        startedAt: true,
        finishedAt: true,

        createdAt: true,
        updatedAt: true,

        workflow: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!execution) {
      throw new NotFoundException('Execution not found');
    }

    return execution;
  }
}
