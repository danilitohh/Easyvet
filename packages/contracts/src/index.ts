import { z } from 'zod';

// HealthResponse is the first shared contract proving both apps can consume one package.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
