import { describe, expect, it, jest } from '@jest/globals';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import type { TenantContext } from '../authorization/authorization.types';

describe('AppointmentsController availability membership summary', () => {
  it('returns safe same-tenant professional labels and suppresses cross-tenant relations', async () => {
    const organizationId = '22222222-2222-4222-8222-222222222222';
    const otherOrganizationId = '33333333-3333-4333-8333-333333333333';
    const createdAt = new Date('2026-09-21T12:00:00.000Z');
    const rule = {
      id: '11111111-1111-4111-8111-111111111111',
      organizationId,
      clinicLocationId: '44444444-4444-4444-8444-444444444444',
      membershipId: '55555555-5555-4555-8555-555555555555',
      dayOfWeek: 1,
      startLocalTime: '09:00',
      endLocalTime: '17:00',
      slotMinutes: 30,
      notes: null,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    };
    const listAvailability = jest.fn(async (requestedOrganizationId: string) => {
      expect(requestedOrganizationId).toBe(organizationId);
      return [
        {
          ...rule,
          membership: {
            id: rule.membershipId,
            organizationId,
            role: 'VETERINARIAN',
            user: { email: 'vet@easyvet.test' },
          },
        },
        {
          ...rule,
          id: '66666666-6666-4666-8666-666666666666',
          membership: {
            id: rule.membershipId,
            organizationId: otherOrganizationId,
            role: 'VETERINARIAN',
            user: { email: 'foreign@other-clinic.test' },
          },
        },
      ];
    });
    const controller = new AppointmentsController({
      listAvailability,
    } as unknown as AppointmentsService);
    const tenant = { organizationId } as TenantContext;

    const result = await controller.listAvailability(tenant);
    expect(result).toMatchObject([
      { membership: { id: rule.membershipId, user: { email: 'vet@easyvet.test' } } },
      { membership: null },
    ]);
    expect(listAvailability).toHaveBeenCalledWith(organizationId);
    expect(result[0]).not.toHaveProperty('membership.organizationId');
    expect(result[1]).not.toHaveProperty('membership.user.email', 'foreign@other-clinic.test');
  });
});
