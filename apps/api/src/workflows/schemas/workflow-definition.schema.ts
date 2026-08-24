import { z } from 'zod';

const workflowStepSchema = z.object({
  id: z.string().min(1),

  type: z.enum(['TRANSFORM', 'HTTP_REQUEST', 'FILTER']),

  config: z.record(z.string(), z.json()),
});

export const workflowDefinitionSchema = z.object({
  trigger: z.object({
    type: z.enum(['MANUAL', 'WEBHOOK']),
  }),

  steps: z.array(workflowStepSchema).max(20),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
