import { z } from 'zod';

export const workflowDataSchema = z.record(z.string(), z.json());

export type WorkflowData = z.infer<typeof workflowDataSchema>;

const transformStepSchema = z.object({
  id: z.string().min(1),

  type: z.literal('TRANSFORM'),

  config: z.object({
    template: workflowDataSchema,
  }),
});

export type TransformStep = z.infer<typeof transformStepSchema>;

const filterStepSchema = z.object({
  id: z.string().min(1),

  type: z.literal('FILTER'),

  config: z.object({
    field: z.string().min(1),
    operator: z.enum(['EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN']),
    value: z.json(),
  }),
});

export type FilterStep = z.infer<typeof filterStepSchema>;

const httpRequestStepSchema = z.object({
  id: z.string().min(1),

  type: z.literal('HTTP_REQUEST'),

  config: z.record(z.string(), z.json()),
});

export type HttpRequestStep = z.infer<typeof httpRequestStepSchema>;

const workflowStepSchema = z.discriminatedUnion('type', [
  transformStepSchema,
  filterStepSchema,
  httpRequestStepSchema,
]);

export const workflowDefinitionSchema = z.object({
  trigger: z.object({
    type: z.enum(['MANUAL', 'WEBHOOK']),
  }),

  steps: z.array(workflowStepSchema).max(20),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

export type WorkflowStep = z.infer<typeof workflowStepSchema>;
