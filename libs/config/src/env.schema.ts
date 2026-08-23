import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  API_PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().min(1).default('localhost'),

  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  JWT_SECRET: z.string().min(32),

  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
});
