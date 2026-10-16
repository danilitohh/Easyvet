import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { appConfig } from '../config/app';
import { useAuth } from './useAuth';
import { RealtimeContext, type RealtimeConnectionStatus } from './realtime-context';

// This client receives only short-lived server-signed tokens; the Supabase secret stays server-side.
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, activeMembership } = useAuth();
  const organizationId = activeMembership?.organization.id;
  const organizationIdRef = useRef(organizationId);
  organizationIdRef.current = organizationId;
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<RealtimeConnectionStatus>('disabled');
  const getClient = useMemo(() => {
    const url = appConfig.supabaseUrl;
    const key = appConfig.supabasePublishableKey;
    let clientPromise: Promise<SupabaseClient> | undefined;
    let cachedToken:
      { value: string; refreshAt: number; organizationId: string | undefined } | undefined;
    return () => {
      if (!url || !key) return Promise.resolve(null);
      clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(url, key, {
          auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
          accessToken: async () => {
            if (
              cachedToken &&
              cachedToken.organizationId === organizationIdRef.current &&
              Date.now() < cachedToken.refreshAt
            ) {
              return cachedToken.value;
            }
            const response = await fetch(`${appConfig.apiBaseUrl}/auth/realtime-token`, {
              credentials: 'include',
              headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error(`Realtime authorization failed (${response.status})`);
            const payload = (await response.json()) as { accessToken?: unknown };
            if (typeof payload.accessToken !== 'string') {
              throw new Error('Realtime authorization token is missing');
            }
            cachedToken = {
              value: payload.accessToken,
              refreshAt: Date.now() + 4 * 60_000,
              organizationId: organizationIdRef.current,
            };
            return cachedToken.value;
          },
        }),
      );
      return clientPromise;
    };
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !organizationId) {
      setStatus('disabled');
      return;
    }

    let active = true;
    let refreshTimer: number | undefined;
    let removeChannel: (() => void) | undefined;
    setStatus('connecting');
    void getClient()
      .then((client) => {
        if (!active || !client) return;
        const channel = client
          .channel(`easyvet:org:${organizationId}`, { config: { private: true } })
          .on('broadcast', { event: 'tenant_data_changed' }, () => {
            if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
            refreshTimer = window.setTimeout(() => {
              setRevision((current) => current + 1);
              refreshTimer = undefined;
            }, 250);
          })
          .subscribe((channelStatus) => {
            if (channelStatus === 'SUBSCRIBED') setStatus('connected');
            else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
              setStatus('error');
            } else if (channelStatus === 'CLOSED') setStatus('disabled');
          });
        removeChannel = () => void client.removeChannel(channel);
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      setStatus('disabled');
      removeChannel?.();
    };
  }, [authStatus, getClient, organizationId]);

  const value = useMemo(() => ({ revision, status }), [revision, status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
