import type {
  AppointmentResponse,
  LocationResponse,
  MembershipResponse,
  PatientResponse,
} from '@veterinary-saas/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AgendaFilters } from './AgendaFilters';
import type { AgendaFilters as AgendaFilterValues } from './agendaUtils';

const location = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Sede Norte',
  status: 'ACTIVE',
  address: null,
  city: 'Bogotá',
} satisfies LocationResponse;

const membership = {
  id: '66666666-6666-4666-8666-666666666666',
  role: 'VETERINARIAN',
  clinicalRole: null,
  status: 'ACTIVE',
  user: {
    email: 'vet@easyvet.test',
    displayName: null,
  },
  professionalProfileConfigured: false,
} satisfies MembershipResponse;

const patient = {
  id: '44444444-4444-4444-8444-444444444444',
  ownerId: '55555555-5555-4555-8555-555555555555',
  name: 'Luna',
  species: 'Canino',
  breed: null,
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
  createdAt: '2026-09-19T12:00:00.000-05:00',
  updatedAt: '2026-09-19T12:00:00.000-05:00',
  owner: {
    id: '55555555-5555-4555-8555-555555555555',
    firstName: 'Ana',
    lastName: 'Pérez',
    email: null,
    phone: null,
    status: 'ACTIVE',
  },
} satisfies PatientResponse;

const appointment = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  clinicLocationId: location.id,
  patientId: patient.id,
  ownerId: patient.ownerId,
  assignedMembershipId: membership.id,
  createdByMembershipId: membership.id,
  status: 'SCHEDULED',
  startsAt: '2026-09-21T14:00:00.000-05:00',
  endsAt: '2026-09-21T14:45:00.000-05:00',
  reason: 'Consulta',
  notes: null,
  observations: null,
  ownerConfirmedAt: null,
  clinicConfirmedAt: null,
  cancelledAt: null,
  cancelledByMembershipId: null,
  cancellationReason: null,
  createdAt: '2026-09-19T12:00:00.000-05:00',
  updatedAt: '2026-09-19T12:00:00.000-05:00',
  patient: { id: patient.id, name: patient.name, status: 'ACTIVE' },
  owner: {
    id: patient.owner.id,
    firstName: patient.owner.firstName,
    lastName: patient.owner.lastName,
    status: 'ACTIVE',
  },
  clinicLocation: location,
  assignedMembership: {
    id: membership.id,
    role: membership.role,
    user: { email: membership.user.email },
  },
} satisfies AppointmentResponse;

const baseFilters: AgendaFilterValues = {
  clinicLocationId: '',
  assignedMembershipId: '',
  patientId: '',
  status: 'ALL',
};

function renderFilters(overrides: Partial<Parameters<typeof AgendaFilters>[0]> = {}) {
  const onChange = vi.fn();
  const onPatientSearchChange = vi.fn();
  const onReset = vi.fn();
  render(
    <AgendaFilters
      filters={baseFilters}
      locations={[location]}
      memberships={[membership]}
      patients={[patient]}
      patientSearch=""
      observedAppointments={[appointment]}
      onChange={onChange}
      onPatientSearchChange={onPatientSearchChange}
      onReset={onReset}
      {...overrides}
    />,
  );
  return { onChange, onPatientSearchChange, onReset };
}

describe('AgendaFilters', () => {
  it('renders tenant-safe filter controls with Spanish labels', () => {
    renderFilters();
    expect(screen.getByRole('region', { name: /filtros de agenda/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Sede')).toBeInTheDocument();
    expect(screen.getByLabelText('Profesional')).toBeInTheDocument();
    expect(screen.getByLabelText('Estado')).toBeInTheDocument();
    expect(screen.getByLabelText('Patient')).toBeInTheDocument();
  });

  it('emits a location filter change', () => {
    const { onChange } = renderFilters();
    fireEvent.change(screen.getByLabelText('Sede'), { target: { value: location.id } });
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, clinicLocationId: location.id });
  });

  it('emits a professional filter change', () => {
    const { onChange } = renderFilters();
    fireEvent.change(screen.getByLabelText('Profesional'), { target: { value: membership.id } });
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, assignedMembershipId: membership.id });
  });

  it('exposes the explicit unassigned professional option', () => {
    renderFilters();
    expect(screen.getByRole('option', { name: 'Sin profesional asignado' })).toBeInTheDocument();
  });

  it('emits a Spanish status filter change', () => {
    const { onChange } = renderFilters();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'COMPLETED' } });
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, status: 'COMPLETED' });
    expect(screen.getByRole('option', { name: 'Completada' })).toBeInTheDocument();
  });

  it('passes patient search text to the page owner', () => {
    const { onPatientSearchChange } = renderFilters();
    fireEvent.change(screen.getByPlaceholderText('Nombre del Patient'), {
      target: { value: 'Lun' },
    });
    expect(onPatientSearchChange).toHaveBeenCalledWith('Lun');
  });

  it('emits a patient selection change', () => {
    const { onChange } = renderFilters();
    fireEvent.change(screen.getByLabelText('Patient'), { target: { value: patient.id } });
    expect(onChange).toHaveBeenCalledWith({ ...baseFilters, patientId: patient.id });
  });

  it('shows reset only when a filter is active', () => {
    const { onReset } = renderFilters({
      filters: { ...baseFilters, status: 'WAITING_ROOM' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
