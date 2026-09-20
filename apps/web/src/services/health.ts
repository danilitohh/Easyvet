import { healthResponseSchema, type HealthResponse } from '@veterinary-saas/contracts';
import { appConfig } from '../config/app';

// Fetch the minimal API contract and validate the payload at the browser boundary.
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${appConfig.apiBaseUrl}/health`, signal ? { signal } : {});
  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }
  return healthResponseSchema.parse(await response.json());
}
