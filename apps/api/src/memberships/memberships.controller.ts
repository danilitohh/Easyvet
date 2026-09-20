import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { MembershipResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { PERMISSIONS } from '../authorization/permissions';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { MembershipsService } from './memberships.service';

function resourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

function toMembershipResponse(
  membership: Awaited<ReturnType<MembershipsService['findByIdForOrganization']>>,
): MembershipResponse {
  if (!membership) throw resourceNotFound();
  return {
    id: membership.id,
    role: membership.role,
    status: membership.status,
    user: membership.user,
  };
}

// Membership reads expose minimal user data and are scoped to the active organization.
@Controller('organization/memberships')
@UseGuards(TenantContextGuard, PermissionGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.MEMBERSHIPS.READ)
  async list(@CurrentTenant() tenant: TenantContext): Promise<MembershipResponse[]> {
    const memberships = await this.memberships.findForOrganization(tenant.organizationId);
    return memberships.map((membership) => toMembershipResponse(membership));
  }

  @Get(':membershipId')
  @RequirePermissions(PERMISSIONS.MEMBERSHIPS.READ)
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
  ): Promise<MembershipResponse> {
    const membership = await this.memberships.findByIdForOrganization(
      tenant.organizationId,
      membershipId,
    );
    return toMembershipResponse(membership);
  }
}
