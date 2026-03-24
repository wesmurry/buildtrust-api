import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:8080'),
  CLERK_SECRET_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_REGION: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default('bids@buildtrust.app'),
});

export const env = envSchema.parse(process.env);
