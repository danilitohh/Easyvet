import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { OrganizationSelectorPage } from './OrganizationSelectorPage';
import { RegistrationPage } from './RegistrationPage';
import { useAuth } from '../contexts/useAuth';
import { AuthBoundary } from '../app/AuthBoundary';
import { AppHeader } from '../components/layout/AppHeader';
import { getRouteMeta } from '../data/navigation';
import { authApi } from '../services/auth';

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../services/auth', () => ({ authApi: { register: vi.fn() } }));

const mockedUseAuth = vi.mocked(useAuth);
const mockedRegister = vi.mocked(authApi.register);
const membership = {
  id: '00000000-0000-4000-8000-000000000010',
  role: 'OWNER' as const,
  status: 'ACTIVE' as const,
  organization: {
    id: '00000000-0000-4000-8000-000000000011',
    name: 'Clínica Norte',
    slug: 'clinica-norte',
  },
  permissions: ['organization.read', 'locations.read'] as const,
};

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<p>Dashboard</p>} />
        <Route path="/seleccionar-organizacion" element={<p>Selector</p>} />
        <Route path="/plataforma" element={<p>Consola super admin</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('authentication screens', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
    mockedRegister.mockReset();
    mockedRegister.mockResolvedValue({ success: true });
  });

  it('renders the login form fields', () => {
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      switchOrganization: vi.fn(),
      logout: vi.fn(),
    } as never);
    renderLogin();
    expect(screen.getByLabelText('Correo')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('keeps clinic registration and password recovery links without exposing super admin setup', () => {
    mockedUseAuth.mockReturnValue({
      login: vi.fn(),
      switchOrganization: vi.fn(),
      logout: vi.fn(),
    } as never);
    renderLogin();

    expect(screen.getByRole('link', { name: '¿Olvidaste tu contraseña?' })).toHaveAttribute(
      'href',
      '/recuperar-contrasena',
    );
    expect(screen.getByRole('link', { name: 'Crea tu cuenta gratis' })).toHaveAttribute(
      'href',
      '/registro',
    );
    expect(screen.queryByText('¿Administras Easyvet?')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Configurar acceso de plataforma' }),
    ).not.toBeInTheDocument();
  });

  it('does not expose the one-time platform-admin bootstrap from clinic registration', () => {
    render(
      <MemoryRouter initialEntries={['/registro']}>
        <RegistrationPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Registra tu clínica' })).toBeInTheDocument();
    expect(screen.queryByText('¿Administras Easyvet?')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Configurar acceso de plataforma' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute(
      'href',
      '/privacidad',
    );
    expect(screen.getByRole('link', { name: 'Términos y condiciones' })).toHaveAttribute(
      'href',
      '/terminos',
    );
  });

  it('submits explicit legal consent when creating a clinic account', async () => {
    render(
      <MemoryRouter initialEntries={['/registro']}>
        <RegistrationPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Amelia Castro' } });
    fireEvent.change(screen.getByLabelText('Nombre de la veterinaria'), {
      target: { value: 'Clínica Norte' },
    });
    fireEvent.change(screen.getByLabelText('Correo de trabajo'), {
      target: { value: 'amelia@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'a-secure-password-123' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Crear mi cuenta' }));

    await waitFor(() =>
      expect(mockedRegister).toHaveBeenCalledWith({
        displayName: 'Amelia Castro',
        clinicName: 'Clínica Norte',
        email: 'amelia@example.com',
        password: 'a-secure-password-123',
        privacyConsent: true,
        termsConsent: true,
      }),
    );
  });

  it('does not submit registration without explicit legal consent', async () => {
    render(
      <MemoryRouter initialEntries={['/registro']}>
        <RegistrationPage />
      </MemoryRouter>,
    );

    const submit = screen.getByRole('button', { name: 'Crear mi cuenta' });
    fireEvent.submit(submit.closest('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Debes aceptar la Política de privacidad y los Términos y condiciones',
    );
    expect(mockedRegister).not.toHaveBeenCalled();
  });

  it('submits credentials and navigates to the dashboard', async () => {
    const login = vi.fn().mockResolvedValue({
      organizationSelectionRequired: false,
      user: { platformRole: 'USER' },
    });
    mockedUseAuth.mockReturnValue({ login, switchOrganization: vi.fn(), logout: vi.fn() } as never);
    renderLogin();
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'vet@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(login).toHaveBeenCalledWith({ email: 'vet@example.com', password: 'secret' });
  });

  it('navigates to organization selection when the server requires it', async () => {
    const login = vi.fn().mockResolvedValue({
      organizationSelectionRequired: true,
      user: { platformRole: 'USER' },
    });
    mockedUseAuth.mockReturnValue({ login, switchOrganization: vi.fn(), logout: vi.fn() } as never);
    renderLogin();
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'multi@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(screen.getByText('Selector')).toBeInTheDocument());
  });

  it('navigates platform administrators to the platform console', async () => {
    const login = vi.fn().mockResolvedValue({
      organizationSelectionRequired: false,
      user: { platformRole: 'PLATFORM_ADMIN' },
    });
    mockedUseAuth.mockReturnValue({ login, switchOrganization: vi.fn(), logout: vi.fn() } as never);
    renderLogin();
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'admin@easyvet.co' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(screen.getByText('Consola super admin')).toBeInTheDocument());
  });

  it('shows a generic error when credentials are rejected', async () => {
    mockedUseAuth.mockReturnValue({
      login: vi.fn().mockRejectedValue(new Error('Invalid credentials')),
      switchOrganization: vi.fn(),
      logout: vi.fn(),
    } as never);
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña no válidos.');
  });

  it('disables the submit action while login is pending', async () => {
    let resolveLogin!: (value: unknown) => void;
    const login = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve;
      }),
    );
    mockedUseAuth.mockReturnValue({ login, switchOrganization: vi.fn(), logout: vi.fn() } as never);
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByRole('button', { name: 'Ingresando…' })).toBeDisabled();
    resolveLogin({ organizationSelectionRequired: false, user: { platformRole: 'USER' } });
  });
});

describe('organization selector', () => {
  beforeEach(() => {
    mockedUseAuth.mockReset();
  });

  function renderSelector() {
    return render(
      <MemoryRouter initialEntries={['/seleccionar-organizacion']}>
        <Routes>
          <Route path="/seleccionar-organizacion" element={<OrganizationSelectorPage />} />
          <Route path="/dashboard" element={<p>Dashboard</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('renders every active organization option', () => {
    mockedUseAuth.mockReturnValue({
      memberships: [membership],
      switchOrganization: vi.fn(),
    } as never);
    renderSelector();
    expect(screen.getByRole('button', { name: /clínica norte/i })).toBeInTheDocument();
  });

  it('switches the selected membership and returns to the dashboard', async () => {
    const switchOrganization = vi.fn().mockResolvedValue({});
    mockedUseAuth.mockReturnValue({ memberships: [membership], switchOrganization } as never);
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /clínica norte/i }));
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(switchOrganization).toHaveBeenCalledWith(membership.id);
  });

  it('shows an error when switching organization fails', async () => {
    mockedUseAuth.mockReturnValue({
      memberships: [membership],
      switchOrganization: vi.fn().mockRejectedValue(new Error('failed')),
    } as never);
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /clínica norte/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible seleccionar esa organización.',
    );
  });

  it('redirects an unauthenticated user from a protected route to login', async () => {
    mockedUseAuth.mockReturnValue({ status: 'unauthenticated' } as never);
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<AuthBoundary />}>
            <Route path="/dashboard" element={<p>Protected dashboard</p>} />
          </Route>
          <Route path="/login" element={<p>Login screen</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Protected dashboard')).not.toBeInTheDocument();
  });

  it('logs out from the shell header and navigates to login', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockedUseAuth.mockReturnValue({
      user: { id: membership.id, email: 'vet@example.com', platformRole: 'USER' },
      activeMembership: membership,
      logout,
    } as never);
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={<AppHeader route={getRouteMeta('/dashboard')} onOpenMenu={() => undefined} />}
          />
          <Route path="/login" element={<p>Login screen</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(screen.getByText('Login screen')).toBeInTheDocument());
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
