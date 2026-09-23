import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInventoryResource } from './useInventoryResources';

const resourceMocks = vi.hoisted(() => ({
  organizationId: 'organization-north',
  dataMode: 'api' as 'api' | 'mock',
}));

vi.mock('../../config/app', () => ({
  appConfig: { dataMode: resourceMocks.dataMode },
}));

vi.mock('../shared/hooks', () => ({
  useActiveOrganizationId: () => resourceMocks.organizationId,
}));

// ResourceHarness exposes the hook state so the refresh transition can be asserted directly.
function ResourceHarness({ loader }: { loader: (signal: AbortSignal) => Promise<string> }) {
  const resource = useInventoryResource('inventory-test', true, loader);
  return (
    <>
      <button onClick={resource.reload}>Actualizar</button>
      <output>{resource.data ?? 'Sin datos'}</output>
      <span>{resource.loading ? 'Cargando' : 'Listo'}</span>
    </>
  );
}

describe('useInventoryResource', () => {
  beforeEach(() => {
    resourceMocks.organizationId = 'organization-north';
    resourceMocks.dataMode = 'api';
  });

  it('keeps same-tenant data mounted while a refresh is in flight', async () => {
    let resolveRefresh: ((value: string) => void) | undefined;
    const loader = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockResolvedValueOnce('stock previo')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }),
      );
    render(<ResourceHarness loader={loader} />);

    expect(await screen.findByText('stock previo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(screen.getByText('stock previo')).toBeInTheDocument();
    expect(screen.getByText('Cargando')).toBeInTheDocument();

    resolveRefresh?.('stock actualizado');
    expect(await screen.findByText('stock actualizado')).toBeInTheDocument();
  });

  it('aborts the old tenant request and hides its late stock result after switching', async () => {
    let resolveNorthRefresh: ((value: string) => void) | undefined;
    let northRefreshSignal: AbortSignal | undefined;
    const loader = vi.fn<(signal: AbortSignal) => Promise<string>>((signal) => {
      if (loader.mock.calls.length === 1) return Promise.resolve('stock norte');
      if (loader.mock.calls.length === 2) {
        northRefreshSignal = signal;
        return new Promise((resolve) => {
          resolveNorthRefresh = resolve;
        });
      }
      return Promise.resolve('stock sur');
    });
    const view = render(<ResourceHarness loader={loader} />);

    expect(await screen.findByText('stock norte')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));

    resourceMocks.organizationId = 'organization-south';
    view.rerender(<ResourceHarness loader={loader} />);

    await waitFor(() => expect(northRefreshSignal?.aborted).toBe(true));
    expect(screen.queryByText('stock norte')).toBeNull();
    expect(await screen.findByText('stock sur')).toBeInTheDocument();
    resolveNorthRefresh?.('stock norte tardío');
    await waitFor(() => expect(screen.queryByText('stock norte tardío')).toBeNull());
  });
});
