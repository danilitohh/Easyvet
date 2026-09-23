import { ClinicLocationStatus } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { LocationsService } from './locations.service';

const organizationId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const actorMembershipId = '33333333-3333-4333-8333-333333333333';

// The focused service harness proves each blocker prevents mutation after the location lock.
function createHarness(blocker?: 'cash' | 'grooming' | 'appointment') {
  const transactionClient = {
    $queryRaw: jest.fn(async () => [{ id: locationId, status: ClinicLocationStatus.ACTIVE }]),
    cashSession: {
      findFirst: jest.fn(async () => (blocker === 'cash' ? { id: 'cash-session' } : null)),
    },
    groomingVisit: {
      findFirst: jest.fn(async () => (blocker === 'grooming' ? { id: 'grooming-visit' } : null)),
    },
    appointment: {
      findFirst: jest.fn(async () => (blocker === 'appointment' ? { id: 'appointment' } : null)),
    },
    clinicLocation: {
      update: jest.fn(async (_input: unknown) => ({
        id: locationId,
        status: ClinicLocationStatus.SUSPENDED,
      })),
      findUniqueOrThrow: jest.fn(),
    },
    organizationAuditEvent: { create: jest.fn(async () => ({})) },
  };
  const prisma = {
    $transaction: jest.fn((work: (tx: typeof transactionClient) => Promise<unknown>) =>
      work(transactionClient),
    ),
  };
  return { service: new LocationsService(prisma as never), prisma, transactionClient };
}

describe('LocationsService.deactivate', () => {
  it.each([
    ['cash', 'LOCATION_HAS_OPEN_CASH_SESSION'],
    ['grooming', 'LOCATION_HAS_ACTIVE_GROOMING'],
    ['appointment', 'LOCATION_HAS_FUTURE_APPOINTMENTS'],
  ] as const)('blocks a location while %s work exists', async (blocker, code) => {
    const { service, transactionClient } = createHarness(blocker);

    await expect(
      service.deactivate(organizationId, locationId, actorMembershipId),
    ).rejects.toMatchObject({ status: 409, response: { code } });

    expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transactionClient.clinicLocation.update).not.toHaveBeenCalled();
    expect(transactionClient.organizationAuditEvent.create).not.toHaveBeenCalled();
  });

  it('deactivates only after the locked location has no blocking work', async () => {
    const { service, transactionClient } = createHarness();

    const result = await service.deactivate(organizationId, locationId, actorMembershipId);

    expect(result.status).toBe(ClinicLocationStatus.SUSPENDED);
    expect(transactionClient.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transactionClient.clinicLocation.update).toHaveBeenCalledWith({
      where: { id: locationId },
      data: { status: ClinicLocationStatus.SUSPENDED },
    });
    expect(transactionClient.organizationAuditEvent.create).toHaveBeenCalledTimes(1);
  });
});
