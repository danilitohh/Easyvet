import type { AppointmentResponse } from '@veterinary-saas/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { useAuth } from '../../contexts/useAuth';
import { AppointmentDetail } from './AppointmentDetail';

const detailActionMocks = vi.hoisted(() => ({
  cancelAppointment: vi.fn(),
  checkInAppointment: vi.fn(),
  startAppointment: vi.fn(),
  completeAppointment: vi.fn(),
  markNoShow: vi.fn(),
  confirmByClinic: vi.fn(),
}));

vi.mock('./agendaApi', () => ({ agendaApi: detailActionMocks }));
vi.mock('../../contexts/useAuth', () => ({ useAuth: vi.fn() }));

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
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      activeMembership: { permissions: ['appointments.update', 'appointments.cancel'] },
    } as never);
    detailActionMocks.cancelAppointment.mockReset();
    detailActionMocks.checkInAppointment.mockReset();
    detailActionMocks.startAppointment.mockReset();
    detailActionMocks.completeAppointment.mockReset();
    detailActionMocks.markNoShow.mockReset();
    detailActionMocks.confirmByClinic.mockReset();
  });

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
    expect(screen.getByText('Confirmación propietario')).toBeInTheDocument();
    expect(screen.getByText('Confirmación clínica')).toBeInTheDocument();
    expect(screen.getByText('Owner solicitó cambio')).toBeInTheDocument();
  });

  it('renders a confirmed owner without exposing a manual owner action', () => {
    detailMocks.state = {
      data: {
        ...appointment,
        ownerConfirmedAt: '2030-01-08T14:00:00.000Z',
      },
      loading: false,
      error: null,
      reload: vi.fn(),
    };
    renderDetail();
    expect(screen.getAllByText('Confirmada')).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: /confirmar por propietario/i }),
    ).not.toBeInTheDocument();
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

  it('exposes scheduling actions only for mutable scheduled appointments and cancels explicitly', async () => {
    const scheduled: AppointmentResponse = {
      ...appointment,
      status: 'SCHEDULED',
      cancellationReason: null,
    };
    detailMocks.state = { data: scheduled, loading: false, error: null, reload: vi.fn() };
    detailActionMocks.cancelAppointment.mockResolvedValue({
      ...scheduled,
      status: 'CANCELLED',
      cancellationReason: 'Owner solicita cambio',
    });
    renderDetail();
    expect(screen.getByRole('link', { name: 'Editar información' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reprogramar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar cita' }));
    fireEvent.change(screen.getByLabelText('Motivo de cancelación'), {
      target: { value: 'Owner solicita cambio' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cancelación' }));
    await waitFor(() =>
      expect(detailActionMocks.cancelAppointment).toHaveBeenCalledWith(appointment.id, {
        cancellationReason: 'Owner solicita cambio',
      }),
    );
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar cita' })).not.toBeInTheDocument();
  });

  it('runs the lifecycle state machine through explicit actions', async () => {
    const scheduled: AppointmentResponse = {
      ...appointment,
      status: 'SCHEDULED',
      clinicConfirmedAt: null,
      cancellationReason: null,
    };
    detailMocks.state = { data: scheduled, loading: false, error: null, reload: vi.fn() };
    vi.mocked(useAuth).mockReturnValue({
      activeMembership: {
        permissions: [
          'appointments.update',
          'appointments.checkIn',
          'appointments.start',
          'appointments.complete',
          'appointments.markNoShow',
        ],
      },
    } as never);
    detailActionMocks.checkInAppointment.mockResolvedValue({
      ...scheduled,
      status: 'WAITING_ROOM',
    });

    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar llegada' }));
    await waitFor(() =>
      expect(detailActionMocks.checkInAppointment).toHaveBeenCalledWith(scheduled.id),
    );
    expect(screen.getByText('En espera')).toBeInTheDocument();
  });

  it('offers start and complete only along the approved sequence', async () => {
    const waiting: AppointmentResponse = {
      ...appointment,
      status: 'WAITING_ROOM',
      cancellationReason: null,
    };
    detailMocks.state = { data: waiting, loading: false, error: null, reload: vi.fn() };
    vi.mocked(useAuth).mockReturnValue({
      activeMembership: { permissions: ['appointments.start', 'appointments.complete'] },
    } as never);
    detailActionMocks.startAppointment.mockResolvedValue({
      ...waiting,
      status: 'IN_PROGRESS',
    });
    detailActionMocks.completeAppointment.mockResolvedValue({
      ...waiting,
      status: 'COMPLETED',
    });

    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar atención' }));
    await waitFor(() =>
      expect(detailActionMocks.startAppointment).toHaveBeenCalledWith(waiting.id),
    );
    expect(screen.getByText('En curso')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Completar cita' }));
    await waitFor(() =>
      expect(detailActionMocks.completeAppointment).toHaveBeenCalledWith(waiting.id),
    );
    expect(screen.getByText('Completada')).toBeInTheDocument();
  });

  it('shows clinic confirmation as pending and updates it through its endpoint', async () => {
    const scheduled: AppointmentResponse = {
      ...appointment,
      status: 'SCHEDULED',
      clinicConfirmedAt: null,
      cancellationReason: null,
    };
    detailMocks.state = { data: scheduled, loading: false, error: null, reload: vi.fn() };
    vi.mocked(useAuth).mockReturnValue({
      activeMembership: { permissions: ['appointments.update'] },
    } as never);
    detailActionMocks.confirmByClinic.mockResolvedValue({
      ...scheduled,
      clinicConfirmedAt: '2030-01-08T15:00:00.000Z',
    });

    renderDetail();
    expect(screen.getAllByText('Pendiente')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar por clínica' }));
    await waitFor(() =>
      expect(detailActionMocks.confirmByClinic).toHaveBeenCalledWith(scheduled.id),
    );
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
  });

  it('hides workflow actions when the membership lacks the required permission', () => {
    const scheduled: AppointmentResponse = {
      ...appointment,
      status: 'SCHEDULED',
      cancellationReason: null,
    };
    detailMocks.state = { data: scheduled, loading: false, error: null, reload: vi.fn() };
    vi.mocked(useAuth).mockReturnValue({
      activeMembership: { permissions: ['appointments.read'] },
    } as never);
    renderDetail();
    expect(screen.queryByRole('button', { name: 'Registrar llegada' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument();
  });

  it('requires explicit confirmation before marking a patient as no-show', async () => {
    const scheduled: AppointmentResponse = {
      ...appointment,
      status: 'SCHEDULED',
      cancellationReason: null,
    };
    detailMocks.state = { data: scheduled, loading: false, error: null, reload: vi.fn() };
    vi.mocked(useAuth).mockReturnValue({
      activeMembership: { permissions: ['appointments.markNoShow'] },
    } as never);
    detailActionMocks.markNoShow.mockResolvedValue({ ...scheduled, status: 'NO_SHOW' });
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'No asistió' }));
    expect(screen.getByRole('heading', { name: 'Marcar como no asistió' })).toBeInTheDocument();
    expect(detailActionMocks.markNoShow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar no-show' }));
    await waitFor(() => expect(detailActionMocks.markNoShow).toHaveBeenCalledWith(scheduled.id));
    expect(screen.getByText('No asistió')).toBeInTheDocument();
  });

  it('reloads after a stale workflow conflict and explains the refresh', async () => {
    const scheduled: AppointmentResponse = {
      ...appointment,
      status: 'SCHEDULED',
      cancellationReason: null,
    };
    const reload = vi.fn();
    detailMocks.state = { data: scheduled, loading: false, error: null, reload };
    vi.mocked(useAuth).mockReturnValue({
      activeMembership: { permissions: ['appointments.checkIn'] },
    } as never);
    detailActionMocks.checkInAppointment.mockRejectedValue(
      new ApiError('Conflict', 409, 'APPOINTMENT_STATE_CONFLICT'),
    );
    renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar llegada' }));
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/La cita cambió mientras la estabas viendo/)).toBeInTheDocument();
  });
});
