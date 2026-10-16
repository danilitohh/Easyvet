import type { ActiveMembership, OrganizationCurrentResponse } from '@veterinary-saas/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgendaPage } from './AgendaPage';

const mocks = vi.hoisted(() => ({
  membership: {
    id: '66666666-6666-4666-8666-666666666666',
    role: 'VETERINARIAN',
    status: 'ACTIVE',
    organization: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Easyvet Norte',
      slug: 'easyvet-norte',
    },
    permissions: ['appointments.read'],
  } as ActiveMembership,
  organization: {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Easyvet Norte',
    slug: 'easyvet-norte',
    status: 'ACTIVE',
    timezone: 'America/Bogota',
    locale: 'es-CO',
    currencyCode: 'COP',
  } as OrganizationCurrentResponse,
  organizationLoading: false,
  appointmentsLoading: false,
  appointmentsError: null as unknown,
  appointmentsData: { data: [] },
}));

vi.mock('../../auth/useCan', () => ({ useCan: () => true }));
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ activeMembership: mocks.membership }),
}));
vi.mock('./useAgenda', () => ({
  initialAgendaRange: () => ({ from: '2026-09-21T05:00:00Z', to: '2026-09-28T05:00:00Z' }),
  useAgendaOrganization: () => ({
    data: mocks.organizationLoading ? null : mocks.organization,
    loading: mocks.organizationLoading,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaReferenceData: () => ({
    data: { locations: [] },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaMemberships: () => ({
    data: { data: [], page: 1, pageSize: 20, total: 0 },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaAppointments: () => ({
    data: mocks.appointmentsData,
    loading: mocks.appointmentsLoading,
    error: mocks.appointmentsError,
    reload: vi.fn(),
  }),
  useAgendaPatients: () => ({ data: { data: [] }, loading: false, error: null, reload: vi.fn() }),
  useAgendaAppointment: () => ({ data: null, loading: false, error: null, reload: vi.fn() }),
}));

type CalendarProps = {
  view: string;
  date: string;
  onViewChange: (view: 'month' | 'week' | 'day' | 'list') => void;
  onOpenAppointment: (id: string) => void;
};

vi.mock('./AgendaCalendar', () => ({
  AgendaCalendar: ({ view, date, onViewChange, onOpenAppointment }: CalendarProps) => (
    <div data-testid="agenda-calendar">
      <span>{`${view}:${date}`}</span>
      <button type="button" onClick={() => onViewChange('day')}>
        Cambiar a día
      </button>
      <button
        type="button"
        onClick={() => onOpenAppointment('11111111-1111-4111-8111-111111111111')}
      >
        Abrir cita
      </button>
    </div>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderAgenda(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/agenda/citas/:appointmentId" element={<AgendaPage />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('AgendaPage URL and tenant orchestration', () => {
  beforeEach(() => {
    mocks.membership = {
      ...mocks.membership,
      organization: { ...mocks.membership.organization, id: mocks.organization.id },
    };
    mocks.organizationLoading = false;
    mocks.appointmentsLoading = false;
    mocks.appointmentsError = null;
    mocks.appointmentsData = { data: [] };
  });

  it('hydrates the calendar from view/date URL state', () => {
    renderAgenda('/agenda?view=week&date=2026-09-21');
    expect(screen.getByTestId('agenda-calendar')).toHaveTextContent('week:2026-09-21');
    expect(screen.getByText(/Easyvet Norte.*America\/Bogota/i)).toBeInTheDocument();
  });

  it('shows the organization loading state before initializing the calendar', () => {
    mocks.organizationLoading = true;
    renderAgenda('/agenda');
    expect(screen.getByRole('status', { name: 'Cargando agenda' })).toBeInTheDocument();
    expect(screen.queryByTestId('agenda-calendar')).not.toBeInTheDocument();
  });

  it('shows an explicit empty state when the selected range has no appointments', () => {
    renderAgenda('/agenda?view=month&date=2026-09-21');
    expect(screen.getByText('No hay citas para este período')).toBeInTheDocument();
  });

  it('writes a view change back to the URL without losing the date', () => {
    renderAgenda('/agenda?view=week&date=2026-09-21');
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar a día' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/agenda?view=day&date=2026-09-21');
  });

  it('supports list view in URL state', () => {
    renderAgenda('/agenda?view=list&date=2026-09-21');
    expect(screen.getByTestId('agenda-calendar')).toHaveTextContent('list:2026-09-21');
  });

  it('opens appointment detail using the semantic detail route', () => {
    renderAgenda('/agenda?view=day&date=2026-09-21');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir cita' }));
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/agenda/citas/11111111-1111-4111-8111-111111111111?view=day&date=2026-09-21',
    );
  });

  it('clears the detail route when the active tenant changes', () => {
    const rendered = renderAgenda('/agenda/citas/11111111-1111-4111-8111-111111111111?view=day');
    mocks.membership = {
      ...mocks.membership,
      organization: {
        ...mocks.membership.organization,
        id: '99999999-9999-4999-8999-999999999999',
      },
    };
    rendered.rerender(
      <MemoryRouter
        initialEntries={['/agenda/citas/11111111-1111-4111-8111-111111111111?view=day']}
      >
        <Routes>
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/agenda/citas/:appointmentId" element={<AgendaPage />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('location')).toHaveTextContent('/agenda?view=day');
  });
});
