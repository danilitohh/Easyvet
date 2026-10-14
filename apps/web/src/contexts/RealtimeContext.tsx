import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
  const client = useMemo<SupabaseClient | null>(() => {
    const url = appConfig.supabaseUrl;
    const key = appConfig.supabasePublishableKey;
    if (!url || !key) return null;

    let cachedToken: { value: string; refreshAt: number; organizationId: string | undefined } | undefined;
    return createClient(url, key, {
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
    });
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !organizationId || !client) {
      setStatus('disabled');
      return;
    }

    let refreshTimer: number | undefined;
    setStatus('connecting');
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

    return () => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      setStatus('disabled');
      void client.removeChannel(channel);
    };
  }, [authStatus, client, organizationId]);

  const value = useMemo(() => ({ revision, status }), [revision, status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
