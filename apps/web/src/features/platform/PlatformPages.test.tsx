import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformOrganizationDetailPage } from './PlatformPages';
import { platformApi } from './platformApi';

vi.mock('./platformApi', () => ({
  platformApi: { organizationDetail: vi.fn() },
}));

const organizationId = 'c2d02a42-e03a-4f78-99e9-78186c2a7851';

describe('PlatformOrganizationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.organizationDetail).mockResolvedValue({
      id: organizationId,
      name: 'Clínica Central',
      slug: 'clinica-central',
      status: 'ACTIVE',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
      memberCount: 2,
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
      memberships: {
        total: 2,
        active: 2,
        invited: 0,
        suspended: 0,
        byRole: [
          { role: 'OWNER', count: 1 },
          { role: 'VETERINARIAN', count: 1 },
        ],
      },
      locations: {
        total: 1,
        data: [
          {
            id: '6a58a437-91ee-4f66-94e9-3e6853b086c2',
            name: 'Sede principal',
            status: 'ACTIVE',
            city: 'Bogotá',
          },
        ],
      },
      recentAdministrativeActivity: [],
    });
  });

  it('renders clinic metadata and aggregate data without personal or clinical records', async () => {
    render(
      <MemoryRouter initialEntries={[`/plataforma/clinicas/${organizationId}`]}>
        <Routes>
          <Route
            path="/plataforma/clinicas/:organizationId"
            element={<PlatformOrganizationDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Clínica Central' })).toBeInTheDocument();
    expect(screen.getByText('Sede principal')).toBeInTheDocument();
    expect(screen.getByText('Veterinario/a')).toBeInTheDocument();
    expect(screen.getByText(/no se exponen cuentas personales/i)).toBeInTheDocument();
    expect(screen.queryByText('Luna')).not.toBeInTheDocument();
    expect(platformApi.organizationDetail).toHaveBeenCalledWith(organizationId, expect.anything());
  });
});
