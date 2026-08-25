import { z } from 'zod';

export const executionInputSchema = z.record(z.string(), z.json());
