import type {
  AvailabilityRuleResponse,
  OrganizationCurrentResponse,
} from '@veterinary-saas/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilityPage } from './AvailabilityPage';

const mocks = vi.hoisted(() => ({
  createAvailability: vi.fn(),
  updateAvailability: vi.fn(),
  deactivateAvailability: vi.fn(),
  availabilityReload: vi.fn(),
  navigate: vi.fn(),
  activeOrganizationId: '22222222-2222-4222-8222-222222222222',
  rules: [] as AvailabilityRuleResponse[],
  membershipLookup: vi.fn(),
}));

vi.mock('./agendaApi', () => ({
  agendaApi: {
    createAvailability: mocks.createAvailability,
    updateAvailability: mocks.updateAvailability,
    deactivateAvailability: mocks.deactivateAvailability,
  },
}));
vi.mock('./useAgenda', () => ({
  notifyAvailabilityChanged: vi.fn(),
  useAgendaAvailability: () => ({
    data: {
      data: mocks.rules,
      activeCount: mocks.rules.filter((rule) => rule.isActive).length,
      pagination: { page: 1, pageSize: 20, total: mocks.rules.length, totalPages: 1 },
    },
    loading: false,
    error: null,
    reload: mocks.availabilityReload,
  }),
  useAgendaAvailabilityRule: () => ({
    data: null,
    loading: false,
    error: null,
    reload: mocks.availabilityReload,
  }),
  useAgendaOrganization: () => ({
    data: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Easyvet Norte',
      slug: 'easyvet-norte',
      status: 'ACTIVE',
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    } satisfies OrganizationCurrentResponse,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaReferenceData: () => ({
    data: {
      locations: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          organizationId: '22222222-2222-4222-8222-222222222222',
          name: 'Sede Norte',
          status: 'ACTIVE',
          address: null,
          city: 'Bogotá',
        },
      ],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaMemberships: (search: string, page: number) => mocks.membershipLookup(search, page),
}));
vi.mock('../../auth/useCan', () => ({ useCan: () => true }));
vi.mock('../shared/hooks', () => ({
  useActiveOrganizationId: () => mocks.activeOrganizationId,
}));

function renderAvailability(path = '/agenda/disponibilidad') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agenda/disponibilidad" element={<AvailabilityPage />} />
        <Route path="/agenda/disponibilidad/nueva" element={<AvailabilityPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AvailabilityPage', () => {
  beforeEach(() => {
    mocks.rules = [];
    mocks.createAvailability.mockReset();
    mocks.updateAvailability.mockReset();
    mocks.deactivateAvailability.mockReset();
    mocks.availabilityReload.mockReset();
    mocks.membershipLookup.mockReset();
    mocks.membershipLookup.mockReturnValue({
      data: { data: [], page: 1, pageSize: 1, total: 2 },
      loading: false,
      error: null,
      reload: vi.fn(),
    });
  });

  it('searches and paginates professionals for availability rules', () => {
    renderAvailability('/agenda/disponibilidad/nueva');
    fireEvent.change(screen.getByPlaceholderText('Nombre o correo del profesional'), {
      target: { value: 'vet@' },
    });
    expect(mocks.membershipLookup).toHaveBeenLastCalledWith('vet@', 1);
    fireEvent.click(
      screen.getByRole('button', { name: 'Paginación de profesionales: página siguiente' }),
    );
    expect(mocks.membershipLookup).toHaveBeenLastCalledWith('vet@', 2);
  });

  it('explains unrestricted mode when no active rules exist', () => {
    renderAvailability();
    expect(screen.getByText(/modo UNRESTRICTED/i)).toBeInTheDocument();
    expect(screen.getAllByText(/No hay reglas activas aplicables/i).length).toBeGreaterThan(0);
  });

  it('validates civil time windows before creating a rule', () => {
    renderAvailability('/agenda/disponibilidad/nueva');
    fireEvent.change(screen.getByLabelText('Inicio local'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('Fin local'), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar regla' }));
    expect(screen.getByText('La hora final debe ser posterior.')).toBeInTheDocument();
    expect(mocks.createAvailability).not.toHaveBeenCalled();
  });

  it('creates a general-location rule without tenant fields', async () => {
    mocks.createAvailability.mockResolvedValue({});
    renderAvailability('/agenda/disponibilidad/nueva');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar regla' }));
    await waitFor(() => expect(mocks.createAvailability).toHaveBeenCalledTimes(1));
    expect(mocks.createAvailability).toHaveBeenCalledWith({
      clinicLocationId: '33333333-3333-4333-8333-333333333333',
      membershipId: null,
      dayOfWeek: 1,
      startLocalTime: '09:00',
      endLocalTime: '18:00',
      slotMinutes: 30,
      notes: null,
    });
  });
});
