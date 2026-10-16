import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listAppointments: vi.fn(),
  findAppointment: vi.fn(),
}));

vi.mock('../agenda/agendaApi', () => ({
  agendaApi: {
    listAppointments: mocks.listAppointments,
    findAppointment: mocks.findAppointment,
  },
}));

import { groomingApi } from './groomingApi';

const ids = {
  organization: '20000000-0000-4000-8000-000000000001',
  patient: '20000000-0000-4000-8000-000000000002',
  owner: '20000000-0000-4000-8000-000000000003',
  appointment: '20000000-0000-4000-8000-000000000004',
  location: '20000000-0000-4000-8000-000000000005',
  creator: '20000000-0000-4000-8000-000000000006',
};

// A cancelled linked appointment remains selectable only to support safe draft unlinking.
const cancelledAppointment = {
  id: ids.appointment,
  organizationId: ids.organization,
  clinicLocationId: ids.location,
  patientId: ids.patient,
  ownerId: ids.owner,
  assignedMembershipId: null,
  createdByMembershipId: ids.creator,
  status: 'CANCELLED',
  startsAt: '2030-01-08T15:00:00.000Z',
  endsAt: '2030-01-08T15:30:00.000Z',
  reason: 'Cita antigua de QA',
  notes: null,
  observations: null,
  ownerConfirmedAt: null,
  clinicConfirmedAt: null,
  cancelledAt: '2030-01-07T15:00:00.000Z',
  cancelledByMembershipId: ids.creator,
  cancellationReason: 'Cambio solicitado',
  createdAt: '2030-01-01T15:00:00.000Z',
  updatedAt: '2030-01-07T15:00:00.000Z',
  patient: { id: ids.patient, name: 'Luna', status: 'ACTIVE' },
  owner: { id: ids.owner, firstName: 'Camila', lastName: 'Rojas', status: 'ACTIVE' },
  clinicLocation: {
    id: ids.location,
    name: 'Sede Norte',
    status: 'ACTIVE',
    address: null,
    city: null,
  },
  assignedMembership: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listAppointments.mockResolvedValue({
    data: [],
    pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
  });
  mocks.findAppointment.mockResolvedValue(cancelledAppointment);
});

describe('grooming Appointment options', () => {
  it('keeps Agenda list queries inside its 90-day range limit', async () => {
    await groomingApi.appointmentsForPatient(ids.patient);

    const query = mocks.listAppointments.mock.calls[0]?.[0];
    expect(query).toMatchObject({ patientId: ids.patient });
    expect(Date.parse(query.to) - Date.parse(query.from)).toBeLessThan(90 * 24 * 60 * 60 * 1000);
  });

  it('loads the already linked historical appointment so a draft can unlink it', async () => {
    const options = await groomingApi.appointmentsForPatient(ids.patient, ids.appointment);

    expect(mocks.findAppointment).toHaveBeenCalledWith(ids.appointment, undefined);
    expect(options.data).toEqual([cancelledAppointment]);
  });
});
