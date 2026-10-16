import {
  createInventoryItemRequestSchema,
  createInventoryMovementRequestSchema,
  createInventoryTransferRequestSchema,
  inventoryBatchListResponseSchema,
  inventoryBatchListQuerySchema,
  inventoryDashboardSummarySchema,
  inventoryItemListQuerySchema,
  inventoryItemListResponseSchema,
  inventoryItemSchema,
  inventoryItemStockDetailSchema,
  inventoryMovementListQuerySchema,
  inventoryMovementListResponseSchema,
  inventoryStockListResponseSchema,
  inventoryStockQuerySchema,
  inventoryTransferResponseSchema,
  updateInventoryItemRequestSchema,
  type CreateInventoryItemRequest,
  type CreateInventoryMovementRequest,
  type CreateInventoryTransferRequest,
  type InventoryDashboardSummary,
  type InventoryBatchListQuery,
  type InventoryBatchListResponse,
  type InventoryItem,
  type InventoryItemListQuery,
  type InventoryItemListResponse,
  type InventoryItemStockDetail,
  type InventoryMovementListQuery,
  type InventoryMovementListResponse,
  type InventoryStockListResponse,
  type InventoryStockQuery,
  type InventoryTransferResponse,
  type UpdateInventoryItemRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

export const INVENTORY_MUTATED_EVENT = 'easyvet:inventory-mutated';

// Query encoding preserves false boolean filters and uses the same Zod bounds as API consumers.
function queryString(value: Record<string, unknown>): string {
  const query = new URLSearchParams();
  Object.entries(value).forEach(([key, entry]) => {
    if (entry !== undefined && entry !== null && entry !== '') query.set(key, String(entry));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

function withSignal(signal?: AbortSignal): { signal: AbortSignal } | Record<string, never> {
  return signal ? { signal } : {};
}

// Each response is parsed at the browser boundary so decimal quantities remain exact strings.
export const inventoryApi = {
  async summary(signal?: AbortSignal): Promise<InventoryDashboardSummary> {
    return inventoryDashboardSummarySchema.parse(
      await apiClient('/inventory/summary', withSignal(signal)),
    );
  },

  async listItems(
    input: InventoryItemListQuery,
    signal?: AbortSignal,
  ): Promise<InventoryItemListResponse> {
    const query = inventoryItemListQuerySchema.parse(input);
    return inventoryItemListResponseSchema.parse(
      await apiClient(`/inventory/items${queryString(query)}`, withSignal(signal)),
    );
  },

  async findItem(id: string, signal?: AbortSignal): Promise<InventoryItem> {
    return inventoryItemSchema.parse(await apiClient(`/inventory/items/${id}`, withSignal(signal)));
  },

  async createItem(
    input: CreateInventoryItemRequest,
    signal?: AbortSignal,
  ): Promise<InventoryItem> {
    return inventoryItemSchema.parse(
      await apiClient('/inventory/items', {
        method: 'POST',
        body: createInventoryItemRequestSchema.parse(input),
        ...withSignal(signal),
      }),
    );
  },

  async updateItem(
    id: string,
    input: UpdateInventoryItemRequest,
    signal?: AbortSignal,
  ): Promise<InventoryItem> {
    return inventoryItemSchema.parse(
      await apiClient(`/inventory/items/${id}`, {
        method: 'PATCH',
        body: updateInventoryItemRequestSchema.parse(input),
        ...withSignal(signal),
      }),
    );
  },

  async archiveItem(id: string, signal?: AbortSignal): Promise<InventoryItem> {
    return inventoryItemSchema.parse(
      await apiClient(`/inventory/items/${id}/archive`, {
        method: 'POST',
        ...withSignal(signal),
      }),
    );
  },

  async stock(
    input: InventoryStockQuery,
    signal?: AbortSignal,
  ): Promise<InventoryStockListResponse> {
    const query = inventoryStockQuerySchema.parse(input);
    return inventoryStockListResponseSchema.parse(
      await apiClient(`/inventory/stock${queryString(query)}`, withSignal(signal)),
    );
  },

  async itemStock(
    id: string,
    input: Partial<InventoryBatchListQuery> = {},
    signal?: AbortSignal,
  ): Promise<InventoryItemStockDetail> {
    const query = inventoryBatchListQuerySchema.parse(input);
    return inventoryItemStockDetailSchema.parse(
      await apiClient(`/inventory/items/${id}/stock${queryString(query)}`, withSignal(signal)),
    );
  },

  async itemStockAllBatches(id: string, signal?: AbortSignal): Promise<InventoryItemStockDetail> {
    const firstPage = await this.itemStock(id, { page: 1, pageSize: 100 }, signal);
    const batches = [...firstPage.batches];
    for (let page = 2; page <= firstPage.batchPagination.totalPages; page += 1) {
      const nextPage = await this.itemStock(id, { page, pageSize: 100 }, signal);
      batches.push(...nextPage.batches);
    }
    return {
      ...firstPage,
      batches,
      batchPagination: {
        ...firstPage.batchPagination,
        page: 1,
        pageSize: 100,
        totalPages: firstPage.batchPagination.total === 0 ? 0 : 1,
      },
    };
  },

  async batches(
    id: string,
    input: Partial<InventoryBatchListQuery> = {},
    signal?: AbortSignal,
  ): Promise<InventoryBatchListResponse> {
    const query = inventoryBatchListQuerySchema.parse(input);
    return inventoryBatchListResponseSchema.parse(
      await apiClient(`/inventory/items/${id}/batches${queryString(query)}`, withSignal(signal)),
    );
  },

  async movements(
    input: InventoryMovementListQuery,
    signal?: AbortSignal,
  ): Promise<InventoryMovementListResponse> {
    const query = inventoryMovementListQuerySchema.parse(input);
    return inventoryMovementListResponseSchema.parse(
      await apiClient(`/inventory/movements${queryString(query)}`, withSignal(signal)),
    );
  },

  async createMovement(input: CreateInventoryMovementRequest, signal?: AbortSignal): Promise<void> {
    await apiClient('/inventory/movements', {
      method: 'POST',
      body: createInventoryMovementRequestSchema.parse(input),
      ...withSignal(signal),
    });
  },

  async transfer(
    input: CreateInventoryTransferRequest,
    signal?: AbortSignal,
  ): Promise<InventoryTransferResponse> {
    return inventoryTransferResponseSchema.parse(
      await apiClient('/inventory/transfers', {
        method: 'POST',
        body: createInventoryTransferRequestSchema.parse(input),
        ...withSignal(signal),
      }),
    );
  },
};
