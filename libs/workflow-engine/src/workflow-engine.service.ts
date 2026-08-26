import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '@app/database';

import {
  WorkflowData,
  WorkflowDefinition,
  WorkflowStep,
} from './schemas/workflow-definition.schema';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(private readonly database: DatabaseService) {}

  async execute(
    executionId: string,
    definition: WorkflowDefinition,
    triggerPayload: WorkflowData,
  ): Promise<void> {
    const stepExecutions = definition.steps.map((step) => ({
      executionId,
      stepId: step.id,
      stepType: step.type,
    }));

    await this.database.stepExecution.createMany({
      data: stepExecutions,
      skipDuplicates: true,
    });

    let currentData: WorkflowData = triggerPayload;

    for (const step of definition.steps) {
      await this.database.stepExecution.update({
        where: {
          executionId_stepId: {
            executionId,
            stepId: step.id,
          },
        },

        data: {
          status: 'RUNNING',
          startedAt: new Date(),
          error: null,
          input: currentData,
        },
      });

      try {
        currentData = await this.executeStep(step, currentData);

        await this.database.stepExecution.update({
          where: {
            executionId_stepId: {
              executionId,
              stepId: step.id,
            },
          },

          data: {
            status: 'SUCCEEDED',
            output: currentData,
            finishedAt: new Date(),
          },
        });

        this.logger.log(
          `Step ${step.id} succeeded for execution ${executionId}`,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unknown step execution error';

        await this.database.stepExecution.update({
          where: {
            executionId_stepId: {
              executionId,
              stepId: step.id,
            },
          },

          data: {
            status: 'FAILED',
            error: message,
            finishedAt: new Date(),
          },
        });

        this.logger.error(
          `Step ${step.id} failed for execution ${executionId}: ${message}`,
        );

        throw error;
      }
    }
  }

  private executeStep(
    step: WorkflowStep,
    input: WorkflowData,
  ): WorkflowData | Promise<WorkflowData> {
    this.logger.log(`Executing step ${step.id} (${step.type})`);

    switch (step.type) {
      case 'TRANSFORM':
        return this.executeTransform(step, input);

      case 'FILTER':
        return this.executeFilter(step, input);

      case 'HTTP_REQUEST':
        return this.executeHttpRequest(step, input);
    }
  }

  private executeTransform(
    step: WorkflowStep,
    input: WorkflowData,
  ): WorkflowData {
    void step;

    return input;
  }

  private executeFilter(step: WorkflowStep, input: WorkflowData): WorkflowData {
    void step;

    return input;
  }

  private executeHttpRequest(
    step: WorkflowStep,
    input: WorkflowData,
  ): WorkflowData {
    void step;

    return input;
  }
}
