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
  return readJsonResponse<T>(response);
}

// Multipart requests keep the browser-generated boundary intact while retaining the authenticated session.
export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  return readJsonResponse<T>(response);
}

// Private file downloads use session cookies and return bytes only after the API authorizes the tenant.
export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, { credentials: 'include' });
  if (!response.ok) await readJsonResponse<never>(response);
  return response.blob();
}

// Public signing calls deliberately omit session cookies and any private application authentication.
export async function publicApiClient<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${appConfig.apiBaseUrl}${path}`, {
    ...init,
    credentials: 'omit',
  });
  return readJsonResponse<T>(response);
}

// One error parser preserves the API's safe machine code across JSON and multipart calls.
async function readJsonResponse<T>(response: Response): Promise<T> {
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
