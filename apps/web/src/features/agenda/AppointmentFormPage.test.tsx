import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentResponse } from '@veterinary-saas/contracts';
import { ApiError } from '../../services/apiClient';
import { AppointmentFormPage } from './AppointmentFormPage';

const mocks = vi.hoisted(() => ({
  createAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  rescheduleAppointment: vi.fn(),
  reloadSlots: vi.fn(),
  mode: 'create' as 'create' | 'edit' | 'reschedule',
  appointment: null as AppointmentResponse | null,
}));

vi.mock('./agendaApi', () => ({
  agendaApi: {
    createAppointment: mocks.createAppointment,
    updateAppointment: mocks.updateAppointment,
    rescheduleAppointment: mocks.rescheduleAppointment,
    availableSlots: vi.fn(),
  },
}));

vi.mock('./useAgenda', () => ({
  useAgendaOrganization: () => ({
    data: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Clínica Norte',
      slug: 'clinica-norte',
      status: 'ACTIVE',
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaReferenceData: () => ({
    data: {
      locations: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Sede Norte',
          status: 'ACTIVE',
          address: null,
          city: 'Bogotá',
        },
      ],
      memberships: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          role: 'VETERINARIAN',
          status: 'ACTIVE',
          user: {
            id: '77777777-7777-4777-8777-777777777777',
            email: 'vet@example.com',
            status: 'ACTIVE',
          },
        },
      ],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaPatients: () => ({
    data: {
      data: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          ownerId: '55555555-5555-4555-8555-555555555555',
          name: 'Luna',
          species: 'DOG',
          breed: 'Labrador',
          sex: 'FEMALE',
          birthDate: null,
          birthDateEstimated: false,
          color: null,
          microchipNumber: null,
          currentWeightKg: null,
          sterilized: false,
          notes: null,
          status: 'ACTIVE',
          archivedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          owner: {
            id: '55555555-5555-4555-8555-555555555555',
            firstName: 'Camila',
            lastName: 'Rojas',
            email: null,
            phone: null,
            documentType: null,
            documentNumber: null,
            status: 'ACTIVE',
          },
        },
      ],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaAppointment: () => ({
    data: mocks.appointment,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useAgendaAvailableSlots: () => ({
    data: {
      mode: 'RULES',
      timezone: 'America/Bogota',
      date: '2030-01-08',
      slots: [{ startsAt: '2030-01-08T14:00:00.000Z', endsAt: '2030-01-08T14:30:00.000Z' }],
    },
    loading: false,
    error: null,
    reload: mocks.reloadSlots,
  }),
}));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    activeMembership: {
      organization: { id: '22222222-2222-4222-8222-222222222222' },
      permissions: ['appointments.create', 'appointments.update'],
    },
  }),
}));

const savedAppointment = { id: '11111111-1111-4111-8111-111111111111' };

function renderForm(mode: 'create' | 'edit' | 'reschedule', entry: string) {
  mocks.mode = mode;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/agenda/nueva" element={<AppointmentFormPage mode="create" />} />
        <Route
          path="/agenda/citas/:appointmentId/editar"
          element={<AppointmentFormPage mode="edit" />}
        />
        <Route
          path="/agenda/citas/:appointmentId/reprogramar"
          element={<AppointmentFormPage mode="reschedule" />}
        />
        <Route path="/agenda/citas/:appointmentId" element={<p>Detalle</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const appointment: AppointmentResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  clinicLocationId: '33333333-3333-4333-8333-333333333333',
  patientId: '44444444-4444-4444-8444-444444444444',
  ownerId: '55555555-5555-4555-8555-555555555555',
  assignedMembershipId: null,
  createdByMembershipId: '77777777-7777-4777-8777-777777777777',
  status: 'SCHEDULED',
  startsAt: '2030-01-08T14:00:00.000Z',
  endsAt: '2030-01-08T14:30:00.000Z',
  reason: 'Control general',
  notes: 'Traer carnet',
  observations: null,
  ownerConfirmedAt: null,
  clinicConfirmedAt: null,
  cancelledAt: null,
  cancelledByMembershipId: null,
  cancellationReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  patient: { id: '44444444-4444-4444-8444-444444444444', name: 'Luna', status: 'ACTIVE' },
  owner: {
    id: '55555555-5555-4555-8555-555555555555',
    firstName: 'Camila',
    lastName: 'Rojas',
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
};

describe('AppointmentFormPage', () => {
  beforeEach(() => {
    mocks.createAppointment.mockReset().mockResolvedValue(savedAppointment);
    mocks.updateAppointment.mockReset().mockResolvedValue(savedAppointment);
    mocks.rescheduleAppointment.mockReset().mockResolvedValue(savedAppointment);
    mocks.reloadSlots.mockReset();
    mocks.appointment = null;
  });

  it('derives Owner from the selected active Patient and writes explicit UTC timestamps', async () => {
    renderForm('create', '/agenda/nueva?date=2030-01-08&time=09:00');
    await waitFor(() =>
      expect(screen.getByDisplayValue('Sede Norte · Bogotá')).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText('Patient *'), {
      target: { value: '44444444-4444-4444-8444-444444444444' },
    });
    expect(screen.getByDisplayValue('Camila Rojas')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo *'), { target: { value: 'Control' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));
    await waitFor(() => expect(mocks.createAppointment).toHaveBeenCalled());
    expect(mocks.createAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: '44444444-4444-4444-8444-444444444444',
        ownerId: '55555555-5555-4555-8555-555555555555',
        startsAt: '2030-01-08T14:00:00Z',
        endsAt: '2030-01-08T14:30:00Z',
      }),
    );
  });

  it('keeps an unrestricted scheduling flow manual and maps 409 to a friendly error', async () => {
    mocks.createAppointment.mockRejectedValue(
      new ApiError('conflict', 409, 'APPOINTMENT_CONFLICT'),
    );
    renderForm('create', '/agenda/nueva?date=2030-01-08');
    await waitFor(() => expect(screen.getByLabelText('Patient *')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Patient *'), {
      target: { value: '44444444-4444-4444-8444-444444444444' },
    });
    fireEvent.change(screen.getByLabelText('Motivo *'), { target: { value: 'Control' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cita' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/horario ya no está disponible/i);
    expect(mocks.reloadSlots).toHaveBeenCalled();
  });

  it('uses PATCH for edit and never exposes time fields', async () => {
    mocks.appointment = appointment;
    renderForm('edit', '/agenda/citas/11111111-1111-4111-8111-111111111111/editar');
    expect(await screen.findByDisplayValue('Control general')).toBeInTheDocument();
    expect(screen.queryByLabelText('Fecha *')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo *'), {
      target: { value: 'Control actualizado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(mocks.updateAppointment).toHaveBeenCalledWith(
        appointment.id,
        expect.objectContaining({ reason: 'Control actualizado' }),
      ),
    );
    expect(mocks.rescheduleAppointment).not.toHaveBeenCalled();
  });

  it('uses the explicit reschedule endpoint with organization-local date and time', async () => {
    mocks.appointment = appointment;
    renderForm('reschedule', '/agenda/citas/11111111-1111-4111-8111-111111111111/reprogramar');
    expect(await screen.findByDisplayValue('2030-01-08')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hora *'), { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar cita' }));
    await waitFor(() =>
      expect(mocks.rescheduleAppointment).toHaveBeenCalledWith(appointment.id, {
        startsAt: '2030-01-08T15:00:00Z',
        endsAt: '2030-01-08T15:30:00Z',
      }),
    );
    expect(mocks.updateAppointment).not.toHaveBeenCalled();
  });
});
