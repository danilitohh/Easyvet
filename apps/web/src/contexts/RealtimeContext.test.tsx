import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeProvider } from './RealtimeContext';
import { useRealtimeConnectionStatus } from './useRealtime';

const mocks = vi.hoisted(() => ({
  auth: { status: 'unauthenticated' as string, activeMembership: null as unknown },
  createClient: vi.fn(),
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
    mocks.auth.status = 'unauthenticated';
    mocks.auth.activeMembership = null;
    mocks.channel.on.mockReturnValue(mocks.channel);
    mocks.channel.subscribe.mockImplementation((callback: (status: string) => void) => {
      callback('SUBSCRIBED');
      return mocks.channel;
    });
    mocks.createClient.mockReturnValue({
      channel: vi.fn(() => mocks.channel),
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
  });
});
