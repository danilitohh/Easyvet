import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommercialResource } from './useCommercialResource';

const auth = vi.hoisted(() => ({ organizationId: '70000000-0000-4000-8000-000000000001' }));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ activeMembership: { organization: { id: auth.organizationId } } }),
}));

describe('commercial tenant resource', () => {
  beforeEach(() => {
    auth.organizationId = '70000000-0000-4000-8000-000000000001';
  });

  it('aborts the old organization read and clears its data on tenant switch', async () => {
    const signals: AbortSignal[] = [];
    const loader = (signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>(() => undefined);
    };
    const { result, rerender } = renderHook(() => useCommercialResource(loader));
    await waitFor(() => expect(signals).toHaveLength(1));

    auth.organizationId = '70000000-0000-4000-8000-000000000002';
    rerender();

    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });
});
