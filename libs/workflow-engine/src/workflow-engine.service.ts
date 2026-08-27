import { Injectable, Logger } from '@nestjs/common';

import { DatabaseService } from '@app/database';

import {
  TransformStep,
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
    step: TransformStep,
    input: WorkflowData,
  ): WorkflowData {
    const output: WorkflowData = {};

    const inputPattern = /{{input\.([a-zA-Z0-9_.]+)}}/g;

    for (const [key, value] of Object.entries(step.config.template)) {
      if (typeof value !== 'string') {
        output[key] = value;
        continue;
      }

      output[key] = value.replace(
        inputPattern,
        (match: string, path: string): string => {
          const resolvedValue = this.resolveInputPath(input, path);

          if (resolvedValue === undefined) {
            return match;
          }

          if (typeof resolvedValue === 'string') {
            return resolvedValue;
          }

          if (
            typeof resolvedValue === 'number' ||
            typeof resolvedValue === 'boolean'
          ) {
            return String(resolvedValue);
          }

          if (resolvedValue === null) {
            return 'null';
          }

          return JSON.stringify(resolvedValue);
        },
      );
    }

    return output;
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

  private resolveInputPath(input: WorkflowData, path: string): unknown {
    const parts = path.split('.');

    let current: unknown = input;

    for (const part of parts) {
      if (
        typeof current !== 'object' ||
        current === null ||
        Array.isArray(current)
      ) {
        return undefined;
      }

      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }
}
