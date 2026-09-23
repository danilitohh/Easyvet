import { useCallback, useEffect, useRef, useState } from 'react';
import { appConfig } from '../../config/app';
import { useActiveOrganizationId } from '../shared/hooks';

type ResourceResult<T> = {
  key: string;
  data: T | null;
  loading: boolean;
  error: unknown;
};

// Tenant/query keyed reads abort on scope changes and never render a previous organization's result.
export function useInventoryResource<T>(
  key: string,
  enabled: boolean,
  loader: (signal: AbortSignal) => Promise<T>,
) {
  const organizationId = useActiveOrganizationId();
  const resourceKey = `${organizationId ?? 'none'}:${key}`;
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<ResourceResult<T>>({
    key: '',
    data: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setResult((current) => ({
      key: resourceKey,
      data: current.key === resourceKey ? current.data : null,
      loading: enabled,
      error: null,
    }));
    if (!enabled || !organizationId) return () => controller.abort();
    if (appConfig.dataMode === 'mock') {
      setResult({
        key: resourceKey,
        data: null,
        loading: false,
        error: new Error('Inventario requiere una conexión activa con la API.'),
      });
      return () => controller.abort();
    }
    void loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ key: resourceKey, data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          setResult({ key: resourceKey, data: null, loading: false, error });
        }
      });
    return () => controller.abort();
    // resourceKey/revision are the explicit fetch identity; callers bind loader to the same query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resourceKey, revision]);

  const reload = useCallback(() => setRevision((current) => current + 1), []);
  if (result.key !== resourceKey) return { data: null, loading: enabled, error: null, reload };
  return { data: result.data, loading: result.loading, error: result.error, reload };
}

// Mutations share a tenant-bound signal; switching organization or unmounting aborts in-flight work.
export function useInventoryMutationGuard() {
  const organizationId = useActiveOrganizationId();
  const tenantRef = useRef(organizationId);
  tenantRef.current = organizationId;
  const [controller, setController] = useState(() => new AbortController());

  useEffect(() => {
    const next = new AbortController();
    setController((current) => {
      current.abort();
      return next;
    });
    return () => next.abort();
  }, [organizationId]);

  return {
    signal: controller.signal,
    organizationId,
    isCurrent: () => !controller.signal.aborted && tenantRef.current === organizationId,
  };
}
