import { beforeEach, describe, expect, it, vi } from 'vitest';
import { agendaApi } from './agendaApi';
import { apiClient } from '../../services/apiClient';

vi.mock('../../services/apiClient', () => ({
  apiClient: vi.fn(),
}));

// API tests focus on URL construction and forwarding; contract parsing is covered by shared schemas.
vi.mock('@veterinary-saas/contracts', () => {
  const passthrough = { parse: (value: unknown) => value };
  const arrayPassthrough = { array: () => passthrough };
  return {
    appointmentListResponseSchema: passthrough,
    appointmentResponseSchema: passthrough,
    locationResponseSchema: arrayPassthrough,
    membershipResponseSchema: arrayPassthrough,
    organizationCurrentResponseSchema: passthrough,
    patientsListResponseSchema: passthrough,
  };
});

const apiClientMock = vi.mocked(apiClient);

describe('agendaApi', () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it('sends all supported appointment filters and the requested range', async () => {
    const response = { data: [] };
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
    apiClientMock.mockResolvedValue({ data: [] });
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
    apiClientMock.mockResolvedValue([{ id: 'location' }]);
    await agendaApi.listLocations();
    expect(apiClientMock).toHaveBeenCalledWith('/organization/locations', {});
  });

  it('loads memberships through the approved tenant lookup', async () => {
    apiClientMock.mockResolvedValue([{ id: 'membership' }]);
    await agendaApi.listMemberships();
    expect(apiClientMock).toHaveBeenCalledWith('/organization/memberships', {});
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
});
