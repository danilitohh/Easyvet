import { useCallback, useEffect, useMemo, useState } from 'react';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId } from '../shared/hooks';

export type PreventiveResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

// Read-only preventive resources clear immediately on tenant or route changes and abort stale requests.
export function usePreventiveResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  enabled: boolean,
  dependencies: readonly unknown[],
  mockValue: T,
): PreventiveResourceState<T> {
  const organizationId = useActiveOrganizationId();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<Omit<PreventiveResourceState<T>, 'reload'>>({
    data: null,
    loading: enabled,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, loading: enabled, error: null });
    if (!enabled) return () => controller.abort();
    if (appConfig.dataMode === 'mock') {
      setState({ data: mockValue, loading: false, error: null });
      return () => controller.abort();
    }

    void loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setState({ data: null, loading: false, error });
        }
      });
    return () => controller.abort();
    // Tenant and route dependencies are intentionally supplied by each domain hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, organizationId, revision, ...dependencies]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);
  return useMemo(() => ({ ...state, reload }), [reload, state]);
}
