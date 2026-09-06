import { Injectable } from '@nestjs/common';

import { DatabaseService } from '@app/database';

import {
  FilterStep,
  HttpRequestStep,
  TransformStep,
  WorkflowData,
  workflowDataSchema,
  WorkflowDefinition,
  WorkflowStep,
} from './schemas/workflow-definition.schema';
import { EncryptionService } from '@app/encryption';

import { z } from 'zod';
import { validateHttpUrl } from './security/validate-http-url';
import { safeFetch } from './security/safe-fetch';
import { PinoLogger } from 'nestjs-pino';
type StepResult = {
  output: WorkflowData;
  shouldContinue: boolean;
};

import { SpanStatusCode, trace } from '@opentelemetry/api';

const bearerTokenCredentialSchema = z.object({
  token: z.string().min(1),
});
@Injectable()
export class WorkflowEngineService {
  private readonly tracer = trace.getTracer('relayflow-workflow-engine');

  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: EncryptionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WorkflowEngineService.name);
  }

  async execute(
    executionId: string,
    userId: string,
    definition: WorkflowDefinition,
    triggerPayload: WorkflowData,
  ): Promise<void> {
    return this.tracer.startActiveSpan(
      'workflow.execute',
      {
        attributes: {
          'relayflow.execution.id': executionId,

          'relayflow.workflow.step_count': definition.steps.length,
        },
      },
      async (span) => {
        try {
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

          for (const [index, step] of definition.steps.entries()) {
            const existingStepExecution =
              await this.database.stepExecution.findUnique({
                where: {
                  executionId_stepId: {
                    executionId,
                    stepId: step.id,
                  },
                },
                select: {
                  status: true,
                  output: true,
                },
              });

            if (existingStepExecution?.status === 'SUCCEEDED') {
              const parsedOutput = workflowDataSchema.safeParse(
                existingStepExecution.output,
              );

              if (!parsedOutput.success) {
                throw new Error(`Stored output for step ${step.id} is invalid`);
              }

              currentData = parsedOutput.data;

              continue;
            }

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

                finishedAt: null,
                ...(existingStepExecution?.status !== 'PENDING' && {
                  attempt: {
                    increment: 1,
                  },
                }),
              },
            });

            try {
              const result = await this.executeStepWithTracing(
                executionId,
                step,
                currentData,
                userId,
              );

              currentData = result.output;

              await this.database.stepExecution.update({
                where: {
                  executionId_stepId: {
                    executionId,
                    stepId: step.id,
                  },
                },
                data: {
                  status: 'SUCCEEDED',
                  output: result.output,
                  finishedAt: new Date(),
                },
              });

              this.logger.info(
                {
                  executionId,
                  stepId: step.id,
                  stepType: step.type,
                },
                'Workflow step succeeded',
              );

              if (!result.shouldContinue) {
                const remainingStepIds = definition.steps
                  .slice(index + 1)
                  .map((remainingStep) => remainingStep.id);

                if (remainingStepIds.length > 0) {
                  await this.database.stepExecution.updateMany({
                    where: {
                      executionId,
                      stepId: {
                        in: remainingStepIds,
                      },
                      status: 'PENDING',
                    },
                    data: {
                      status: 'SKIPPED',
                      finishedAt: new Date(),
                    },
                  });
                }

                this.logger.info(
                  {
                    executionId,
                    stepId: step.id,
                    stepType: step.type,
                  },
                  'Workflow execution stopped by filter',
                );

                break;
              }
            } catch (error) {
              const normalizedError =
                error instanceof Error
                  ? error
                  : new Error('Unknown step execution error');

              const message = normalizedError.message;

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
                {
                  executionId,
                  stepId: step.id,
                  stepType: step.type,
                  err: normalizedError,
                },
                'Workflow step failed',
              );

              throw normalizedError;
            }
          }
        } catch (error: unknown) {
          const normalizedError =
            error instanceof Error
              ? error
              : new Error('Unknown workflow execution error');

          span.recordException(normalizedError);

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: normalizedError.message,
          });

          throw normalizedError;
        } finally {
          span.end();
        }
      },
    );
  }

  private async executeStep(
    step: WorkflowStep,
    input: WorkflowData,
    userId: string,
  ): Promise<StepResult> {
    switch (step.type) {
      case 'TRANSFORM': {
        const output = this.executeTransform(step, input);

        return {
          output,
          shouldContinue: true,
        };
      }

      case 'FILTER': {
        const shouldContinue = this.executeFilter(step, input);

        return {
          output: input,
          shouldContinue,
        };
      }

      case 'HTTP_REQUEST': {
        const output = await this.executeHttpRequest(step, input, userId);

        return {
          output,
          shouldContinue: true,
        };
      }
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

  private executeFilter(step: FilterStep, input: WorkflowData): boolean {
    const actualValue = this.resolveInputPath(input, step.config.field);

    const expectedValue = step.config.value;

    switch (step.config.operator) {
      case 'EQUALS':
        return actualValue === expectedValue;

      case 'NOT_EQUALS':
        return actualValue !== expectedValue;

      case 'GREATER_THAN':
        if (
          typeof actualValue !== 'number' ||
          typeof expectedValue !== 'number'
        ) {
          return false;
        }

        return actualValue > expectedValue;

      case 'LESS_THAN':
        if (
          typeof actualValue !== 'number' ||
          typeof expectedValue !== 'number'
        ) {
          return false;
        }

        return actualValue < expectedValue;
    }
  }

  private async executeHttpRequest(
    step: HttpRequestStep,
    input: WorkflowData,
    userId: string,
  ): Promise<WorkflowData> {
    void input;

    const { method, url, headers, body, credentialId } = step.config;

    let credential;

    if (credentialId) {
      credential = await this.database.credential.findFirst({
        where: {
          id: credentialId,
          userId,
        },
        select: {
          type: true,
          ciphertext: true,
          iv: true,
          authTag: true,
        },
      });

      if (!credential) {
        throw new Error(`Credential ${credentialId} not found`);
      }
    }

    const requestHeaders = new Headers(headers);

    if (credential) {
      if (credential.type !== 'BEARER_TOKEN') {
        throw new Error(`Unsupported credential type: ${credential.type}`);
      }

      const decryptedData = this.encryption.decrypt({
        ciphertext: credential.ciphertext,
        iv: credential.iv,
        authTag: credential.authTag,
      });

      const parsedCredential =
        bearerTokenCredentialSchema.safeParse(decryptedData);

      if (!parsedCredential.success) {
        throw new Error(`Credential ${credentialId} contains invalid data`);
      }

      requestHeaders.set(
        'authorization',
        `Bearer ${parsedCredential.data.token}`,
      );
    }

    const requestBody =
      method !== 'GET' && body !== undefined ? JSON.stringify(body) : undefined;

    if (requestBody !== undefined && !requestHeaders.has('content-type')) {
      requestHeaders.set('content-type', 'application/json');
    }

    const validatedUrl = await validateHttpUrl(url);

    const response = await safeFetch(validatedUrl, {
      method,
      headers: requestHeaders,
      body: requestBody,
    });

    if (!response.ok) {
      throw new Error(`HTTP request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return {};
    }

    const contentType = response.headers.get('content-type');

    if (!contentType?.includes('application/json')) {
      throw new Error('HTTP response is not JSON');
    }

    const data: unknown = await response.json();

    const parsedData = workflowDataSchema.safeParse(data);

    if (!parsedData.success) {
      throw new Error('HTTP response is not a valid workflow data object');
    }

    return parsedData.data;
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

  private async executeStepWithTracing(
    executionId: string,
    step: WorkflowStep,
    input: WorkflowData,
    userId: string,
  ): Promise<StepResult> {
    return this.tracer.startActiveSpan(
      'workflow.step.execute',
      {
        attributes: {
          'relayflow.execution.id': executionId,

          'relayflow.step.id': step.id,

          'relayflow.step.type': step.type,
        },
      },
      async (span) => {
        try {
          const result = await this.executeStep(step, input, userId);

          span.setStatus({
            code: SpanStatusCode.OK,
          });

          return result;
        } catch (error: unknown) {
          const normalizedError =
            error instanceof Error
              ? error
              : new Error('Unknown step execution error');

          span.recordException(normalizedError);

          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: normalizedError.message,
          });

          throw normalizedError;
        } finally {
          span.end();
        }
      },
    );
  }
}
