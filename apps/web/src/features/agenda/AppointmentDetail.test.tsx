import type { AppointmentResponse } from '@veterinary-saas/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { AppointmentDetail } from './AppointmentDetail';

const detailMocks = vi.hoisted(() => ({
  state: {
    data: null as AppointmentResponse | null,
    loading: false,
    error: null as unknown,
    reload: vi.fn(),
  },
}));

vi.mock('./useAgenda', () => ({
  useAgendaAppointment: () => detailMocks.state,
}));

const appointment = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  clinicLocationId: '33333333-3333-4333-8333-333333333333',
  patientId: '44444444-4444-4444-8444-444444444444',
  ownerId: '55555555-5555-4555-8555-555555555555',
  assignedMembershipId: null,
  createdByMembershipId: '77777777-7777-4777-8777-777777777777',
  status: 'CANCELLED',
  startsAt: '2026-09-21T14:00:00.000-05:00',
  endsAt: '2026-09-21T14:45:00.000-05:00',
  reason: 'Consulta general',
  notes: 'Traer carnet',
  observations: 'Paciente tranquilo',
  ownerConfirmedAt: null,
  clinicConfirmedAt: '2026-09-20T12:00:00.000-05:00',
  cancelledAt: '2026-09-20T13:00:00.000-05:00',
  cancelledByMembershipId: '77777777-7777-4777-8777-777777777777',
  cancellationReason: 'Owner solicitó cambio',
  createdAt: '2026-09-19T12:00:00.000-05:00',
  updatedAt: '2026-09-20T13:00:00.000-05:00',
  patient: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Luna',
    status: 'ACTIVE',
  },
  owner: {
    id: '55555555-5555-4555-8555-555555555555',
    firstName: 'Ana',
    lastName: 'Pérez',
    status: 'ACTIVE',
  },
  clinicLocation: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Sede Norte',
    status: 'ACTIVE',
    address: null,
    city: 'Bogotá',
  },
  assignedMembership: null,
} satisfies AppointmentResponse;

function renderDetail() {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <AppointmentDetail
        appointmentId={appointment.id}
        timezone="America/Bogota"
        onClose={onClose}
      />
    </MemoryRouter>,
  );
  return { onClose };
}

describe('AppointmentDetail', () => {
  it('renders patient, owner, location and unassigned professional', () => {
    detailMocks.state = { data: appointment, loading: false, error: null, reload: vi.fn() };
    renderDetail();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Luna')).toHaveLength(2);
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Sede Norte')).toBeInTheDocument();
    expect(screen.getByText('Sin profesional asignado')).toBeInTheDocument();
  });

  it('renders status, duration and notes without mutation controls', () => {
    detailMocks.state = { data: appointment, loading: false, error: null, reload: vi.fn() };
    renderDetail();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText('Traer carnet')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /cancelar cita|reprogramar|confirmar/i }),
    ).not.toBeInTheDocument();
  });

  it('renders both confirmation values and cancellation metadata', () => {
    detailMocks.state = { data: appointment, loading: false, error: null, reload: vi.fn() };
    renderDetail();
    expect(screen.getByText('Confirmación Owner')).toBeInTheDocument();
    expect(screen.getByText('Confirmación clínica')).toBeInTheDocument();
    expect(screen.getByText('Owner solicitó cambio')).toBeInTheDocument();
  });

  it('renders a loading state while the detail request is pending', () => {
    detailMocks.state = { data: null, loading: true, error: null, reload: vi.fn() };
    renderDetail();
    expect(screen.getByRole('status', { name: 'Cargando detalle' })).toBeInTheDocument();
  });

  it('renders the cross-tenant not-found boundary for a 404 detail', () => {
    detailMocks.state = {
      data: null,
      loading: false,
      error: new ApiError('No encontrado', 404, 'RESOURCE_NOT_FOUND'),
      reload: vi.fn(),
    };
    renderDetail();
    expect(screen.getByText('Recurso no encontrado')).toBeInTheDocument();
    expect(screen.getByText(/no estar disponible en esta organización/i)).toBeInTheDocument();
  });

  it('closes through the modal callback', () => {
    detailMocks.state = { data: appointment, loading: false, error: null, reload: vi.fn() };
    const { onClose } = renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar diálogo' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
