import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
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

const anonymousState: AuthState = { ...defaultContext, status: 'unauthenticated', user: null };

// AuthProvider restores the server session and keeps token material out of browser storage.
export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isAnonymousRoute = pathname === '/login' || pathname.startsWith('/firmar/');
  const [state, setState] = useState<AuthState>(() =>
    appConfig.dataMode === 'mock'
      ? defaultContext
      : isAnonymousRoute
        ? anonymousState
        : { ...defaultContext, status: 'loading' },
  );

  useEffect(() => {
    if (appConfig.dataMode === 'mock') return;
    if (isAnonymousRoute) {
      setState(anonymousState);
      return;
    }
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
  }, [isAnonymousRoute]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...(isAnonymousRoute ? anonymousState : state),
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
      async changePassword(input) {
        if (appConfig.dataMode !== 'mock') await authApi.changePassword(input);
        const response =
          appConfig.dataMode === 'mock'
            ? await defaultContext.changePassword(input)
            : await authApi.me();
        setState(stateFromResponse(response));
        return response;
      },
      async logout() {
        if (appConfig.dataMode !== 'mock') await authApi.logout();
        setState({ ...defaultContext, status: 'unauthenticated', user: null });
      },
    }),
    [isAnonymousRoute, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
