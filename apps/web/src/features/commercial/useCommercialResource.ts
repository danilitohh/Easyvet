import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/useAuth';
import { useRealtimeRevision } from '../../contexts/useRealtime';

type CommercialResource<T> = {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
};

// Tenant-scoped commercial reads abort on route teardown and clear before loading another organization.
export function useCommercialResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  enabled = true,
): CommercialResource<T> {
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id ?? '';
  const realtimeRevision = useRealtimeRevision();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<CommercialResource<T>, 'reload'>>({
    data: null,
    error: null,
    loading: enabled,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: null, loading: enabled });
    if (!enabled || !organizationId) {
      setState({ data: null, error: null, loading: false });
      return () => controller.abort();
    }
    void loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ data: null, error, loading: false });
      });
    return () => controller.abort();
  }, [enabled, loader, organizationId, revision, realtimeRevision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return { ...state, reload };
}
