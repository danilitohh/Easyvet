import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthMeResponse } from '@veterinary-saas/contracts';
import { appConfig } from '../config/app';
import { ApiError } from '../services/apiClient';
import { authApi } from '../services/auth';
import { AuthContext, defaultContext, type AuthContextValue, type AuthState } from './auth-context';

function stateFromResponse(response: AuthMeResponse): AuthState {
  return {
    status: 'authenticated',
    user: response.user,
    activeMembership: response.activeMembership,
    memberships: response.memberships,
    organizationSelectionRequired: response.organizationSelectionRequired,
  };
}

// AuthProvider restores the server session and keeps token material out of browser storage.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    appConfig.dataMode === 'mock' ? defaultContext : { ...defaultContext, status: 'loading' },
  );

  useEffect(() => {
    if (appConfig.dataMode === 'mock') return;
    let cancelled = false;
    authApi
      .me()
      .then((response) => {
        if (!cancelled) setState(stateFromResponse(response));
      })
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          setState({ ...defaultContext, status: 'unauthenticated', user: null });
        } else if (!cancelled) {
          setState({ ...defaultContext, status: 'unauthenticated', user: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      async login(input) {
        const response =
          appConfig.dataMode === 'mock'
            ? await defaultContext.login(input)
            : await authApi.login(input);
        setState(stateFromResponse(response));
        return response;
      },
      async switchOrganization(membershipId) {
        const response =
          appConfig.dataMode === 'mock'
            ? await defaultContext.switchOrganization(membershipId)
            : await authApi.switchOrganization({ membershipId });
        setState(stateFromResponse(response));
        return response;
      },
      async logout() {
        if (appConfig.dataMode !== 'mock') await authApi.logout();
        setState({ ...defaultContext, status: 'unauthenticated', user: null });
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
