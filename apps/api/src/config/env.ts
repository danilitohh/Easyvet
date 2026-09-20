import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  APP_ORIGIN: z.string().url(),
});

export type Environment = z.infer<typeof environmentSchema>;

// Parse environment variables once at the Nest configuration boundary.
export function validateEnvironment(raw: Record<string, unknown>): Environment {
  return environmentSchema.parse(raw);
}
