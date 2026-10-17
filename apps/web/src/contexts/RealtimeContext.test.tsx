import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeProvider } from './RealtimeContext';
import { useRealtimeConnectionStatus } from './useRealtime';

const mocks = vi.hoisted(() => ({
  auth: { status: 'unauthenticated' as string, activeMembership: null as unknown },
  createClient: vi.fn(),
  fetch: vi.fn(),
  channelFactory: vi.fn(),
  channel: {
    on: vi.fn(),
    subscribe: vi.fn(),
  },
  removeChannel: vi.fn(),
}));

vi.mock('../config/app', () => ({
  appConfig: {
    apiBaseUrl: 'https://easyvet.example/api/v1',
    supabaseUrl: 'https://project.supabase.co',
    supabasePublishableKey: 'test-publishable-key',
  },
}));
vi.mock('./useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

function ConnectionStatus() {
  return <p role="status">{useRealtimeConnectionStatus()}</p>;
}

describe('RealtimeProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.auth.status = 'unauthenticated';
    mocks.auth.activeMembership = null;
    mocks.channelFactory.mockReturnValue(mocks.channel);
    mocks.channel.on.mockReturnValue(mocks.channel);
    mocks.channel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED');
      return mocks.channel;
    });
    mocks.createClient.mockReturnValue({
      channel: mocks.channelFactory,
      removeChannel: mocks.removeChannel,
    });
  });

  it('does not load or create the Supabase client before authentication', () => {
    render(
      <RealtimeProvider>
        <ConnectionStatus />
      </RealtimeProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('disabled');
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('loads Realtime after authentication and subscribes to a private tenant channel', async () => {
    mocks.auth.status = 'authenticated';
    mocks.auth.activeMembership = { organization: { id: 'org-1' } };

    render(
      <RealtimeProvider>
        <ConnectionStatus />
      </RealtimeProvider>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('connected'));
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
    expect(mocks.createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'test-publishable-key',
      expect.objectContaining({
        auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
        accessToken: expect.any(Function),
      }),
    );
    expect(mocks.channel.on).toHaveBeenCalledWith(
      'broadcast',
      { event: 'tenant_data_changed' },
      expect.any(Function),
    );
    expect(mocks.createClient.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({
        accessToken: expect.any(Function),
      }),
    );
    expect(mocks.createClient).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'test-publishable-key',
      expect.any(Object),
    );
  });

  it('requests the short-lived token through the authenticated API session', async () => {
    mocks.auth.status = 'authenticated';
    mocks.auth.activeMembership = { organization: { id: 'org-1' } };
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'signed-token' }),
    });

    render(
      <RealtimeProvider>
        <ConnectionStatus />
      </RealtimeProvider>,
    );

    await waitFor(() => expect(mocks.createClient).toHaveBeenCalledTimes(1));
    const options = mocks.createClient.mock.calls[0]?.[2] as {
      accessToken?: () => Promise<string>;
    };
    await expect(options.accessToken?.()).resolves.toBe('signed-token');
    expect(mocks.fetch).toHaveBeenCalledWith('https://easyvet.example/api/v1/auth/realtime-token', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  });

  it('removes the previous private channel when the active organization changes', async () => {
    mocks.auth.status = 'authenticated';
    mocks.auth.activeMembership = { organization: { id: 'org-1' } };

    const view = render(
      <RealtimeProvider>
        <ConnectionStatus />
      </RealtimeProvider>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('connected'));
    mocks.auth.activeMembership = { organization: { id: 'org-2' } };
    view.rerender(
      <RealtimeProvider>
        <ConnectionStatus />
      </RealtimeProvider>,
    );

    await waitFor(() => expect(mocks.channelFactory).toHaveBeenCalledTimes(2));
    expect(mocks.channelFactory).toHaveBeenNthCalledWith(1, 'easyvet:org:org-1', {
      config: { private: true },
    });
    expect(mocks.channelFactory).toHaveBeenNthCalledWith(2, 'easyvet:org:org-2', {
      config: { private: true },
    });
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
  });
});
