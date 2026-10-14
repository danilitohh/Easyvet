import { useCallback, useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../config/app';
import { useAuth } from '../../contexts/useAuth';
import { useRealtimeRevision } from '../../contexts/useRealtime';

export type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

type TenantResourceOptions<T> = {
  loader: () => Promise<T>;
  enabled?: boolean;
  debounceMs?: number;
  mockValue: T;
};

// Tenant resources clear immediately when the active organization changes, preventing stale cross-tenant UI.
export function useTenantResource<T>({
  loader,
  enabled = true,
  debounceMs = 0,
  mockValue,
}: TenantResourceOptions<T>): ResourceState<T> {
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id ?? 'mock-organization';
  const realtimeRevision = useRealtimeRevision();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<ResourceState<T>, 'reload'>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: enabled, error: null });

    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return () => {
        cancelled = true;
      };
    }

    if (appConfig.dataMode === 'mock') {
      setState({ data: mockValue, loading: false, error: null });
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      void loader()
        .then((data) => {
          if (!cancelled) setState({ data, loading: false, error: null });
        })
        .catch((error: unknown) => {
          if (!cancelled) setState({ data: null, loading: false, error });
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [organizationId, loader, enabled, debounceMs, mockValue, revision, realtimeRevision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return useMemo(() => ({ ...state, reload }), [reload, state]);
}

// Missing organization context keeps tenant-scoped reads disabled and forms isolated.
export function useActiveOrganizationId(): string | undefined {
  const { activeMembership } = useAuth();
  return activeMembership?.organization?.id;
}
