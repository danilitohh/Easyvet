import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateMemberResponse,
  MembershipResponse,
  PaginatedMembershipResponse,
} from '@veterinary-saas/contracts';
import { PERMISSIONS } from '../authorization/permissions';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { MembershipsService } from './memberships.service';
import { CreateStaffDto, ListStaffDto, UpdateStaffDto } from './memberships.dto';

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
    clinicalRole: membership.clinicalRole,
    status: membership.status,
    user: {
      email: membership.user.email,
      displayName: membership.professionalProfile?.displayName ?? null,
    },
    professionalProfileConfigured: membership.professionalProfile !== null,
  };
}

// Membership reads expose minimal user data and are scoped to the active organization.
@Controller('organization')
@UseGuards(TenantContextGuard, PermissionGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get('memberships')
  @RequirePermissions(PERMISSIONS.MEMBERS.READ)
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListStaffDto,
  ): Promise<PaginatedMembershipResponse> {
    const page = await this.memberships.findPageForOrganization(tenant.organizationId, query);
    return { ...page, data: page.data.map((membership) => toMembershipResponse(membership)) };
  }

  @Get('memberships/:membershipId')
  @RequirePermissions(PERMISSIONS.MEMBERS.READ)
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

  @Get('members')
  @RequirePermissions(PERMISSIONS.MEMBERS.READ)
  async listStaff(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ListStaffDto,
  ): Promise<PaginatedMembershipResponse> {
    const page = await this.memberships.findPageForOrganization(tenant.organizationId, query);
    return { ...page, data: page.data.map((member) => toMembershipResponse(member)) };
  }

  @Post('members')
  @RequirePermissions(PERMISSIONS.MEMBERS.CREATE)
  async createStaff(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateStaffDto,
  ): Promise<CreateMemberResponse> {
    const created = await this.memberships.createStaff(
      tenant.organizationId,
      tenant.membershipId,
      tenant.role,
      {
        email: body.email,
        role: body.membershipRole,
        clinicalRole: body.clinicalRole ?? null,
      },
    );
    return {
      membership: toMembershipResponse(created.membership),
      accountAlreadyExisted: created.accountAlreadyExisted,
      temporaryPassword: created.temporaryPassword,
    };
  }

  @Get('members/:membershipId')
  @RequirePermissions(PERMISSIONS.MEMBERS.READ)
  async findStaff(
    @CurrentTenant() tenant: TenantContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
  ): Promise<MembershipResponse> {
    const member = await this.memberships.findByIdForOrganization(
      tenant.organizationId,
      membershipId,
    );
    return toMembershipResponse(member);
  }

  @Patch('members/:membershipId')
  @RequirePermissions(PERMISSIONS.MEMBERS.UPDATE)
  async updateStaff(
    @CurrentTenant() tenant: TenantContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
    @Body() body: UpdateStaffDto,
  ): Promise<MembershipResponse> {
    const member = await this.memberships.updateStaff(
      tenant.organizationId,
      membershipId,
      tenant.membershipId,
      tenant.role,
      {
        ...(body.membershipRole === undefined ? {} : { role: body.membershipRole }),
        ...(body.clinicalRole === undefined ? {} : { clinicalRole: body.clinicalRole }),
      },
    );
    return toMembershipResponse(member);
  }

  @Post('members/:membershipId/suspend')
  @RequirePermissions(PERMISSIONS.MEMBERS.SUSPEND)
  async suspendStaff(
    @CurrentTenant() tenant: TenantContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
  ): Promise<MembershipResponse> {
    const member = await this.memberships.suspendStaff(
      tenant.organizationId,
      membershipId,
      tenant.membershipId,
      tenant.role,
    );
    return toMembershipResponse(member);
  }

  @Post('members/:membershipId/reactivate')
  @RequirePermissions(PERMISSIONS.MEMBERS.SUSPEND)
  async reactivateStaff(
    @CurrentTenant() tenant: TenantContext,
    @Param('membershipId', new ParseUUIDPipe()) membershipId: string,
  ): Promise<MembershipResponse> {
    const member = await this.memberships.reactivateStaff(
      tenant.organizationId,
      membershipId,
      tenant.membershipId,
      tenant.role,
    );
    return toMembershipResponse(member);
  }
}
