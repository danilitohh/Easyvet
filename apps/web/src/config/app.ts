import { z } from 'zod';

const webConfigSchema = z.object({
  name: z.string().trim().min(1).max(120),
  shortName: z.string().trim().min(1).max(40),
  apiBaseUrl: z.string().url(),
  dataMode: z.enum(['api', 'mock']),
});

// Keep isolated mock fixtures available in development but never render them in production builds.
export function resolveDataMode(
  configuredMode: string | undefined,
  isProduction: boolean,
): 'api' | 'mock' {
  const requestedMode = webConfigSchema.shape.dataMode.parse(configuredMode || 'api');
  return isProduction ? 'api' : requestedMode;
}

// Centralize Vite settings so pages do not read environment variables directly.
export const appConfig = webConfigSchema.parse({
  name: import.meta.env.VITE_APP_NAME || 'Easyvet',
  shortName: import.meta.env.VITE_APP_SHORT_NAME || import.meta.env.VITE_APP_NAME || 'Easyvet',
  apiBaseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  dataMode: resolveDataMode(import.meta.env.VITE_DATA_MODE, import.meta.env.PROD),
});

export type WebConfig = typeof appConfig;
