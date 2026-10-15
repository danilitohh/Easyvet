import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../services/auth';
import { PlatformAdminBootstrapPage } from './PlatformAdminBootstrapPage';

vi.mock('../services/auth', () => ({
  authApi: { bootstrapPlatformAdmin: vi.fn() },
}));

describe('PlatformAdminBootstrapPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates the platform account without asking for a clinic', async () => {
    vi.mocked(authApi.bootstrapPlatformAdmin).mockResolvedValue({ success: true });
    render(
      <MemoryRouter>
        <PlatformAdminBootstrapPage />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText(/veterinaria|clínica/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Correo del super admin'), {
      target: { value: 'admin@easyvet.co' },
    });
    fireEvent.change(screen.getByLabelText('Clave de configuración'), {
      target: { value: 'this-is-a-long-bootstrap-secret-for-testing' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña de acceso'), {
      target: { value: 'secure-platform-password-2026' },
    });
    fireEvent.change(screen.getByLabelText('Confirma la contraseña'), {
      target: { value: 'secure-platform-password-2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear super admin' }));

    await waitFor(() =>
      expect(authApi.bootstrapPlatformAdmin).toHaveBeenCalledWith({
        email: 'admin@easyvet.co',
        password: 'secure-platform-password-2026',
        bootstrapSecret: 'this-is-a-long-bootstrap-secret-for-testing',
      }),
    );
    expect(await screen.findByText('Super admin creado')).toBeInTheDocument();
  });
});
