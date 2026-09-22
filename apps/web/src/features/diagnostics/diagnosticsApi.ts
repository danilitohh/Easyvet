import {
  createDiagnosticOrderRequestSchema,
  diagnosticOrderDetailSchema,
  diagnosticOrderListQuerySchema,
  diagnosticOrderListResponseSchema,
  requestDiagnosticOrderRequestSchema,
  resultDiagnosticOrderRequestSchema,
  updateDiagnosticOrderRequestSchema,
  voidDiagnosticOrderRequestSchema,
  type CreateDiagnosticOrderRequest,
  type DiagnosticOrderListQuery,
  type ResultDiagnosticOrderRequest,
  type UpdateDiagnosticOrderRequest,
  type VoidDiagnosticOrderRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

function signalInit(signal?: AbortSignal) {
  return signal ? { signal } : {};
}

function queryString(query: DiagnosticOrderListQuery): string {
  const parsed = diagnosticOrderListQuerySchema.parse(query);
  const params = new URLSearchParams({
    page: String(parsed.page),
    pageSize: String(parsed.pageSize),
  });
  for (const key of ['status', 'category', 'clinicalEncounterId', 'from', 'to'] as const) {
    const value = parsed[key];
    if (value) params.set(key, value);
  }
  return `?${params.toString()}`;
}

// Diagnostic API validates both outgoing payloads and incoming typed responses at the browser boundary.
export const diagnosticsApi = {
  async listByPatient(patientId: string, query: DiagnosticOrderListQuery, signal?: AbortSignal) {
    return diagnosticOrderListResponseSchema.parse(
      await apiClient(
        `/patients/${patientId}/diagnostic-orders${queryString(query)}`,
        signalInit(signal),
      ),
    );
  },
  async findById(id: string, signal?: AbortSignal) {
    return diagnosticOrderDetailSchema.parse(
      await apiClient(`/diagnostic-orders/${id}`, signalInit(signal)),
    );
  },
  async create(encounterId: string, input: CreateDiagnosticOrderRequest, signal?: AbortSignal) {
    return diagnosticOrderDetailSchema.parse(
      await apiClient(`/clinical-encounters/${encounterId}/diagnostic-orders`, {
        method: 'POST',
        body: createDiagnosticOrderRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async updateDraft(id: string, input: UpdateDiagnosticOrderRequest, signal?: AbortSignal) {
    return diagnosticOrderDetailSchema.parse(
      await apiClient(`/diagnostic-orders/${id}`, {
        method: 'PATCH',
        body: updateDiagnosticOrderRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async request(id: string, expectedVersion: number, signal?: AbortSignal) {
    return diagnosticOrderDetailSchema.parse(
      await apiClient(`/diagnostic-orders/${id}/request`, {
        method: 'POST',
        body: requestDiagnosticOrderRequestSchema.parse({ expectedVersion }),
        ...signalInit(signal),
      }),
    );
  },
  async result(id: string, input: ResultDiagnosticOrderRequest, signal?: AbortSignal) {
    return diagnosticOrderDetailSchema.parse(
      await apiClient(`/diagnostic-orders/${id}/result`, {
        method: 'POST',
        body: resultDiagnosticOrderRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
  async void(id: string, input: VoidDiagnosticOrderRequest, signal?: AbortSignal) {
    return diagnosticOrderDetailSchema.parse(
      await apiClient(`/diagnostic-orders/${id}/void`, {
        method: 'POST',
        body: voidDiagnosticOrderRequestSchema.parse(input),
        ...signalInit(signal),
      }),
    );
  },
};
