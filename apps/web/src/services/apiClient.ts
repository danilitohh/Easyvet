import { appConfig } from '../config/app';

// ApiError preserves public error metadata so domain forms can translate conflicts and validation failures.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { body?: unknown };

// apiClient is the only browser boundary for API calls and always sends the HttpOnly session cookie.
export async function apiClient<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, ...requestOptions } = init;
  const headers = new Headers(init.headers);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const requestInit: RequestInit = {
    ...requestOptions,
    credentials: 'include',
    headers,
  };
  if (body !== undefined) requestInit.body = JSON.stringify(body);
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, requestInit);
  const payload = (await response.json().catch(() => null)) as {
    message?: string | string[];
    code?: string;
    details?: unknown;
  } | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : payload?.message || 'No fue posible completar la solicitud.';
    throw new ApiError(message, response.status, payload?.code, payload?.details);
  }
  return payload as T;
}
