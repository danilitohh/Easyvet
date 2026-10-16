import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agendaApi } from './agendaApi';
import { apiClient } from '../../services/apiClient';

vi.mock('../../services/apiClient', () => ({
  apiClient: vi.fn(),
}));

// API tests focus on URL construction and forwarding; contract parsing is covered by shared schemas.
vi.mock('@veterinary-saas/contracts', () => {
  const passthrough = { parse: (value: unknown) => value };
  return {
    appointmentListResponseSchema: passthrough,
    appointmentResponseSchema: passthrough,
    availableSlotsResponseSchema: passthrough,
    availabilityRuleRequestSchema: passthrough,
    availabilityRuleResponseSchema: { ...passthrough, array: () => passthrough },
    cancelAppointmentRequestSchema: { parse: (value: unknown) => value },
    createAppointmentRequestSchema: { parse: (value: unknown) => value },
    locationListResponseSchema: passthrough,
    paginatedMembershipResponseSchema: passthrough,
    organizationCurrentResponseSchema: passthrough,
    patientsListResponseSchema: passthrough,
    rescheduleAppointmentRequestSchema: { parse: (value: unknown) => value },
    updateAppointmentRequestSchema: { parse: (value: unknown) => value },
  };
});

const apiClientMock = vi.mocked(apiClient);

describe('agendaApi', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it('sends all supported appointment filters and the requested range', async () => {
    const response = { data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } };
    apiClientMock.mockResolvedValue(response);
    const signal = new AbortController().signal;
    await agendaApi.listAppointments({
      from: '2026-09-21T05:00:00Z',
      to: '2026-09-28T05:00:00Z',
      clinicLocationId: '33333333-3333-4333-8333-333333333333',
      assignedMembershipId: '66666666-6666-4666-8666-666666666666',
      patientId: '44444444-4444-4444-8444-444444444444',
      status: 'COMPLETED',
      signal,
    });
    expect(apiClientMock).toHaveBeenCalledWith(
      '/appointments?from=2026-09-21T05%3A00%3A00Z&to=2026-09-28T05%3A00%3A00Z&clinicLocationId=33333333-3333-4333-8333-333333333333&assignedMembershipId=66666666-6666-4666-8666-666666666666&patientId=44444444-4444-4444-8444-444444444444&status=COMPLETED',
      { signal },
    );
  });

  it('does not send unsupported empty filters', async () => {
    apiClientMock.mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });
    await agendaApi.listAppointments({
      from: '2026-09-21T05:00:00Z',
      to: '2026-09-22T05:00:00Z',
    });
    expect(apiClientMock).toHaveBeenCalledWith(
      '/appointments?from=2026-09-21T05%3A00%3A00Z&to=2026-09-22T05%3A00%3A00Z',
      {},
    );
  });

  it('uses the tenant-safe detail endpoint', async () => {
    apiClientMock.mockResolvedValue({ id: 'appointment' });
    await agendaApi.findAppointment('11111111-1111-4111-8111-111111111111');
    expect(apiClientMock).toHaveBeenCalledWith(
      '/appointments/11111111-1111-4111-8111-111111111111',
      {},
    );
  });

  it('loads the organization timezone through the current endpoint', async () => {
    apiClientMock.mockResolvedValue({ timezone: 'America/Bogota' });
    await agendaApi.currentOrganization();
    expect(apiClientMock).toHaveBeenCalledWith('/organization/current', {});
  });

  it('loads locations without hardcoded demo values', async () => {
    apiClientMock.mockResolvedValue({
      data: [{ id: 'location' }],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    await agendaApi.listLocations();
    expect(apiClientMock).toHaveBeenCalledWith('/organization/locations?page=1&pageSize=100', {});
  });

  it('loads one searchable page of active memberships through the tenant lookup', async () => {
    apiClientMock.mockResolvedValue({ data: [], page: 2, pageSize: 20, total: 41 });
    const signal = new AbortController().signal;
    await agendaApi.listMemberships({ page: 2, pageSize: 20, search: ' vet ', signal });
    expect(apiClientMock).toHaveBeenCalledWith(
      '/organization/memberships?page=2&pageSize=20&status=ACTIVE&search=vet',
      { signal },
    );
  });

  it('uses paginated active patient search for the patient filter', async () => {
    apiClientMock.mockResolvedValue({ data: [], pagination: { page: 2 } });
    const signal = new AbortController().signal;
    await agendaApi.listPatients({ page: 2, pageSize: 20, search: ' Luna ', signal });
    expect(apiClientMock).toHaveBeenCalledWith(
      '/patients?page=2&pageSize=20&search=Luna&status=ACTIVE&sortBy=name&sortDirection=asc',
      { signal },
    );
  });

  it('creates, updates, reschedules and cancels through explicit endpoints', async () => {
    apiClientMock.mockResolvedValue({ id: 'appointment' });
    const input = {
      clinicLocationId: '33333333-3333-4333-8333-333333333333',
      patientId: '44444444-4444-4444-8444-444444444444',
      ownerId: '55555555-5555-4555-8555-555555555555',
      assignedMembershipId: null,
      startsAt: '2030-01-08T14:00:00.000Z',
      endsAt: '2030-01-08T14:30:00.000Z',
      reason: 'Control',
      notes: null,
    };
    await agendaApi.createAppointment(input);
    expect(apiClientMock).toHaveBeenLastCalledWith('/appointments', {
      method: 'POST',
      body: input,
    });
    await agendaApi.updateAppointment('11111111-1111-4111-8111-111111111111', {
      reason: 'Cambio',
      notes: null,
      assignedMembershipId: null,
    });
    expect(apiClientMock).toHaveBeenLastCalledWith(
      '/appointments/11111111-1111-4111-8111-111111111111',
      {
        method: 'PATCH',
        body: { reason: 'Cambio', notes: null, assignedMembershipId: null },
      },
    );
    await agendaApi.rescheduleAppointment('11111111-1111-4111-8111-111111111111', {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    expect(apiClientMock).toHaveBeenLastCalledWith(
      '/appointments/11111111-1111-4111-8111-111111111111/reschedule',
      {
        method: 'POST',
        body: { startsAt: input.startsAt, endsAt: input.endsAt },
      },
    );
    await agendaApi.cancelAppointment('11111111-1111-4111-8111-111111111111', {
      cancellationReason: 'Solicita cambio',
    });
    expect(apiClientMock).toHaveBeenLastCalledWith(
      '/appointments/11111111-1111-4111-8111-111111111111/cancel',
      {
        method: 'POST',
        body: { cancellationReason: 'Solicita cambio' },
      },
    );
  });

  it('uses explicit lifecycle and clinic confirmation endpoints', async () => {
    apiClientMock.mockResolvedValue({ id: 'appointment' });
    const id = '11111111-1111-4111-8111-111111111111';
    await agendaApi.checkInAppointment(id);
    expect(apiClientMock).toHaveBeenLastCalledWith(`/appointments/${id}/check-in`, {
      method: 'POST',
    });
    await agendaApi.startAppointment(id);
    expect(apiClientMock).toHaveBeenLastCalledWith(`/appointments/${id}/start`, {
      method: 'POST',
    });
    await agendaApi.completeAppointment(id);
    expect(apiClientMock).toHaveBeenLastCalledWith(`/appointments/${id}/complete`, {
      method: 'POST',
    });
    await agendaApi.markNoShow(id);
    expect(apiClientMock).toHaveBeenLastCalledWith(`/appointments/${id}/no-show`, {
      method: 'POST',
    });
    await agendaApi.confirmByClinic(id);
    expect(apiClientMock).toHaveBeenLastCalledWith(`/appointments/${id}/confirm-by-clinic`, {
      method: 'POST',
    });
  });

  it('manages availability rules without adding tenant fields', async () => {
    apiClientMock.mockResolvedValue({ id: 'rule' });
    const id = '88888888-8888-4888-8888-888888888888';
    const input = {
      clinicLocationId: '33333333-3333-4333-8333-333333333333',
      membershipId: null,
      dayOfWeek: 1,
      startLocalTime: '08:00',
      endLocalTime: '17:00',
      slotMinutes: 30,
      notes: 'Horario general',
    };
    await agendaApi.listAvailability();
    expect(apiClientMock).toHaveBeenLastCalledWith('/availability-rules', {});
    await agendaApi.createAvailability(input);
    expect(apiClientMock).toHaveBeenLastCalledWith('/availability-rules', {
      method: 'POST',
      body: input,
    });
    await agendaApi.updateAvailability(id, { endLocalTime: '18:00' });
    expect(apiClientMock).toHaveBeenLastCalledWith(`/availability-rules/${id}`, {
      method: 'PATCH',
      body: { endLocalTime: '18:00' },
    });
    await agendaApi.deactivateAvailability(id);
    expect(apiClientMock).toHaveBeenLastCalledWith(`/availability-rules/${id}`, {
      method: 'DELETE',
    });
  });

  it('loads available slots with tenant-safe scheduling inputs', async () => {
    apiClientMock.mockResolvedValue({
      mode: 'UNRESTRICTED',
      timezone: 'America/Bogota',
      date: '2030-01-08',
      slots: [],
    });
    const signal = new AbortController().signal;
    await agendaApi.availableSlots({
      date: '2030-01-08',
      clinicLocationId: '33333333-3333-4333-8333-333333333333',
      assignedMembershipId: '66666666-6666-4666-8666-666666666666',
      durationMinutes: 30,
      signal,
    });
    expect(apiClientMock).toHaveBeenCalledWith(
      '/agenda/available-slots?date=2030-01-08&clinicLocationId=33333333-3333-4333-8333-333333333333&assignedMembershipId=66666666-6666-4666-8666-666666666666&durationMinutes=30',
      { signal },
    );
  });
});
