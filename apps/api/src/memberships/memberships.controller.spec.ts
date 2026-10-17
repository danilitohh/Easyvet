import { describe, expect, it, jest } from '@jest/globals';
import { MembershipsService } from './memberships.service';
import { ListStaffDto } from './memberships.dto';
import { MembershipsController } from './memberships.controller';
import type { TenantContext } from '../authorization/authorization.types';

describe('MembershipsController paginated lookup', () => {
  it('returns only the requested page and forwards tenant-scoped filters to the service', async () => {
    const member = {
      id: '66666666-6666-4666-8666-666666666666',
      role: 'VETERINARIAN',
      clinicalRole: null,
      status: 'ACTIVE',
      user: { email: 'vet@easyvet.test' },
      professionalProfile: { displayName: 'Dra. Vet' },
    };
    const findPageForOrganization = jest.fn<
      (
        organizationId: string,
        query: ListStaffDto,
      ) => Promise<{ data: (typeof member)[]; page: number; pageSize: number; total: number }>
    >(async () => ({ data: [member], page: 2, pageSize: 20, total: 41 }));
    const controller = new MembershipsController({
      findPageForOrganization,
    } as unknown as MembershipsService);
    const tenant = {
      organizationId: '22222222-2222-4222-8222-222222222222',
    } as TenantContext;
    const query = Object.assign(new ListStaffDto(), {
      page: 2,
      pageSize: 20,
      search: 'vet',
    });

    await expect(controller.list(tenant, query)).resolves.toEqual({
      data: [
        {
          id: member.id,
          role: member.role,
          clinicalRole: null,
          status: member.status,
          user: { email: member.user.email, displayName: 'Dra. Vet' },
          professionalProfileConfigured: true,
        },
      ],
      page: 2,
      pageSize: 20,
      total: 41,
    });
    expect(findPageForOrganization).toHaveBeenCalledWith(tenant.organizationId, query);
  });
});
