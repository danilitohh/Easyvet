import { useCallback, useMemo } from 'react';
import type { OwnerResponse, OwnersListResponse } from '@veterinary-saas/contracts';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId, useTenantResource } from '../shared/hooks';
import { ownersApi, type OwnerListParams } from './ownersApi';

const EMPTY_OWNERS: OwnersListResponse = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
};

// Owner lists are tenant-keyed and debounce only the remote search term.
export function useOwners(params: OwnerListParams = {}) {
  const organizationId = useActiveOrganizationId();
  const normalizedParams = useMemo(() => params, [params]);
  const loader = useCallback(() => ownersApi.list(normalizedParams), [normalizedParams]);
  return useTenantResource({
    loader,
    enabled: appConfig.dataMode === 'mock' || Boolean(organizationId),
    debounceMs: normalizedParams.search ? 320 : 0,
    mockValue: EMPTY_OWNERS,
  });
}

const EMPTY_OWNER: OwnerResponse | null = null;

// Owner details reset as soon as the active organization changes, even when the URL stays the same.
export function useOwner(ownerId: string | undefined) {
  const organizationId = useActiveOrganizationId();
  const loader = useCallback(
    () => (ownerId ? ownersApi.findById(ownerId) : Promise.reject(new Error('Owner requerido'))),
    [ownerId],
  );
  const state = useTenantResource({
    loader,
    enabled: (appConfig.dataMode === 'mock' || Boolean(organizationId)) && Boolean(ownerId),
    mockValue: EMPTY_OWNER,
  });
  return { ...state, owner: state.data };
}
