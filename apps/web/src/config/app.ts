import { z } from 'zod';

const webConfigSchema = z.object({
  appName: z.string().trim().min(1).max(120),
  apiBaseUrl: z.string().url(),
  dataMode: z.enum(['api', 'mock']),
});

// Centralize Vite settings so pages do not read environment variables directly.
export const appConfig = webConfigSchema.parse({
  appName: import.meta.env.VITE_APP_NAME || 'Veterinary SaaS',
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  dataMode: import.meta.env.VITE_DATA_MODE || 'api',
});

export type WebConfig = typeof appConfig;
