import {
  cashMovementSchema,
  cashSessionDetailSchema,
  cashSessionListQuerySchema,
  cashSessionSchema,
  closeCashSessionRequestSchema,
  commercialPageSchema,
  createCashMovementRequestSchema,
  createSaleRequestSchema,
  invoiceDetailSchema,
  invoiceListQuerySchema,
  invoiceSummarySchema,
  openCashSessionRequestSchema,
  saleDetailSchema,
  saleListQuerySchema,
  saleSummarySchema,
  completeSaleRequestSchema,
  updateSaleRequestSchema,
  voidSaleRequestSchema,
  type CashMovementListResponse,
  type CashSessionDetail,
  type CashSessionListResponse,
  type CashSession,
  type CloseCashSessionRequest,
  type CreateCashMovementRequest,
  type CreateSaleRequest,
  type CompleteSaleRequest,
  type InvoiceDetail,
  type InvoiceListResponse,
  type OpenCashSessionRequest,
  type SaleDetail,
  type SaleListResponse,
  type UpdateSaleRequest,
  type VoidSaleRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

// Commercial transport validates every response at the tenant-scoped browser boundary.
export const commercialApi = {
  async listSales(
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
  ): Promise<SaleListResponse> {
    const query = saleListQuerySchema.parse(params);
    return commercialPageSchema(saleSummarySchema).parse(
      await apiClient(`/sales${queryString(query)}`, signal ? { signal } : {}),
    );
  },
  async getSale(id: string, signal?: AbortSignal): Promise<SaleDetail> {
    return saleDetailSchema.parse(await apiClient(`/sales/${id}`, signal ? { signal } : {}));
  },
  async createSale(input: CreateSaleRequest, signal?: AbortSignal): Promise<SaleDetail> {
    return saleDetailSchema.parse(
      await apiClient('/sales', {
        method: 'POST',
        body: createSaleRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
  async updateSale(
    id: string,
    input: UpdateSaleRequest,
    signal?: AbortSignal,
  ): Promise<SaleDetail> {
    return saleDetailSchema.parse(
      await apiClient(`/sales/${id}`, {
        method: 'PATCH',
        body: updateSaleRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
  async completeSale(
    id: string,
    input: CompleteSaleRequest,
    signal?: AbortSignal,
  ): Promise<SaleDetail> {
    return saleDetailSchema.parse(
      await apiClient(`/sales/${id}/complete`, {
        method: 'POST',
        body: completeSaleRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
  async voidSale(id: string, input: VoidSaleRequest, signal?: AbortSignal): Promise<SaleDetail> {
    return saleDetailSchema.parse(
      await apiClient(`/sales/${id}/void`, {
        method: 'POST',
        body: voidSaleRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
  async listInvoices(
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
  ): Promise<InvoiceListResponse> {
    const query = invoiceListQuerySchema.parse(params);
    return commercialPageSchema(invoiceSummarySchema).parse(
      await apiClient(`/invoices${queryString(query)}`, signal ? { signal } : {}),
    );
  },
  async getInvoice(id: string, signal?: AbortSignal): Promise<InvoiceDetail> {
    return invoiceDetailSchema.parse(await apiClient(`/invoices/${id}`, signal ? { signal } : {}));
  },
  async listCashSessions(
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
  ): Promise<CashSessionListResponse> {
    const query = cashSessionListQuerySchema.parse(params);
    return commercialPageSchema(cashSessionSchema).parse(
      await apiClient(`/cash-sessions${queryString(query)}`, signal ? { signal } : {}),
    );
  },
  async currentCashSession(locationId: string, signal?: AbortSignal): Promise<CashSession | null> {
    const result = await apiClient(
      `/cash-sessions/current${queryString({ clinicLocationId: locationId })}`,
      signal ? { signal } : {},
    );
    return result === null ? null : cashSessionSchema.parse(result);
  },
  async getCashSession(id: string, signal?: AbortSignal): Promise<CashSessionDetail> {
    return cashSessionDetailSchema.parse(
      await apiClient(`/cash-sessions/${id}`, signal ? { signal } : {}),
    );
  },
  async listCashMovements(
    id: string,
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
  ): Promise<CashMovementListResponse> {
    const result = await apiClient(
      `/cash-sessions/${id}/movements${queryString(params)}`,
      signal ? { signal } : {},
    );
    return commercialPageSchema(cashMovementSchema).parse(result);
  },
  async openCash(input: OpenCashSessionRequest, signal?: AbortSignal): Promise<CashSessionDetail> {
    return cashSessionDetailSchema.parse(
      await apiClient('/cash-sessions/open', {
        method: 'POST',
        body: openCashSessionRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
  async createCashMovement(
    id: string,
    input: CreateCashMovementRequest,
    signal?: AbortSignal,
  ): Promise<void> {
    await apiClient(`/cash-sessions/${id}/movements`, {
      method: 'POST',
      body: createCashMovementRequestSchema.parse(input),
      ...(signal ? { signal } : {}),
    });
  },
  async closeCash(
    id: string,
    input: CloseCashSessionRequest,
    signal?: AbortSignal,
  ): Promise<CashSessionDetail> {
    return cashSessionDetailSchema.parse(
      await apiClient(`/cash-sessions/${id}/close`, {
        method: 'POST',
        body: closeCashSessionRequestSchema.parse(input),
        ...(signal ? { signal } : {}),
      }),
    );
  },
};
