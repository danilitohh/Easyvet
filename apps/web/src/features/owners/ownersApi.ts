import {
  createOwnerRequestSchema,
  ownerResponseSchema,
  ownersListResponseSchema,
  updateOwnerRequestSchema,
  type CreateOwnerRequest,
  type OwnerResponse,
  type OwnersListResponse,
  type UpdateOwnerRequest,
} from '@veterinary-saas/contracts';
import { apiClient } from '../../services/apiClient';

export type OwnerListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  sortBy?: 'createdAt' | 'firstName' | 'lastName';
  sortDirection?: 'asc' | 'desc';
};

function toQuery(params: OwnerListParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

// Owners API is the only feature boundary allowed to know owner URLs and contracts.
export const ownersApi = {
  async list(params: OwnerListParams = {}): Promise<OwnersListResponse> {
    return ownersListResponseSchema.parse(await apiClient(`/owners${toQuery(params)}`));
  },
  async findById(ownerId: string): Promise<OwnerResponse> {
    return ownerResponseSchema.parse(await apiClient(`/owners/${ownerId}`));
  },
  async create(input: CreateOwnerRequest): Promise<OwnerResponse> {
    return ownerResponseSchema.parse(
      await apiClient('/owners', {
        method: 'POST',
        body: createOwnerRequestSchema.parse(input),
      }),
    );
  },
  async update(ownerId: string, input: UpdateOwnerRequest): Promise<OwnerResponse> {
    return ownerResponseSchema.parse(
      await apiClient(`/owners/${ownerId}`, {
        method: 'PATCH',
        body: updateOwnerRequestSchema.parse(input),
      }),
    );
  },
  async archive(ownerId: string): Promise<OwnerResponse> {
    return ownerResponseSchema.parse(
      await apiClient(`/owners/${ownerId}/archive`, { method: 'POST', body: {} }),
    );
  },
};
