import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../services/apiClient';
import { authApi } from '../services/auth';
import { AuthBoundary } from '../app/AuthBoundary';
import { AuthProvider } from './AuthContext';

vi.mock('../services/auth', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    switchOrganization: vi.fn(),
    changePassword: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockedAuthApi = vi.mocked(authApi);
const restoredSession = {
  user: {
    id: '00000000-0000-4000-8000-000000000020',
    email: 'restored@example.com',
    platformRole: 'USER' as const,
    mustChangePassword: false,
  },
  activeMembership: null,
  memberships: [],
  organizationSelectionRequired: false,
};

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <Routes>
          <Route element={<AuthBoundary />}>
            <Route path="/dashboard" element={<p>Restored dashboard</p>} />
          </Route>
          <Route path="/login" element={<p>Login screen</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function renderMustChangePassword() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider>
        <Routes>
          <Route element={<AuthBoundary />}>
            <Route path="/dashboard" element={<p>Restored dashboard</p>} />
            <Route path="/cambiar-contrasena" element={<p>Change password screen</p>} />
            <Route path="/seleccionar-organizacion" element={<p>Choose organization</p>} />
          </Route>
          <Route path="/login" element={<p>Login screen</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthProvider session restoration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores the server session through /me before rendering protected content', async () => {
    mockedAuthApi.me.mockResolvedValue(restoredSession);
    renderProtected();
    await waitFor(() => expect(screen.getByText('Restored dashboard')).toBeInTheDocument());
    expect(mockedAuthApi.me).toHaveBeenCalledTimes(1);
  });

  it('redirects to login when /me returns 401', async () => {
    mockedAuthApi.me.mockRejectedValue(new ApiError('Authentication required', 401));
    renderProtected();
    await waitFor(() => expect(screen.getByText('Login screen')).toBeInTheDocument());
    expect(screen.queryByText('Restored dashboard')).not.toBeInTheDocument();
  });

  it('forces a temporary-credential user to password change before organization selection or AppShell', async () => {
    mockedAuthApi.me.mockResolvedValue({
      ...restoredSession,
      user: { ...restoredSession.user, mustChangePassword: true },
      organizationSelectionRequired: true,
    });
    renderMustChangePassword();
    await waitFor(() => expect(screen.getByText('Change password screen')).toBeInTheDocument());
    expect(screen.queryByText('Restored dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Choose organization')).not.toBeInTheDocument();
  });
});
