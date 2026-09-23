import { Body, Controller, Get, NotFoundException, Patch, UseGuards } from '@nestjs/common';
import type {
  CommercialSettingsResponse,
  OrganizationCurrentResponse,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { PERMISSIONS } from '../authorization/permissions';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { UpdateCommercialSettingsDto, UpdateOrganizationDto } from './organization.dto';
import { OrganizationsService } from './organizations.service';

function resourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

function toOrganizationResponse(
  organization: Awaited<ReturnType<OrganizationsService['findCurrent']>>,
): OrganizationCurrentResponse {
  if (!organization) throw resourceNotFound();
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    timezone: organization.timezone,
    locale: organization.locale,
    currencyCode: organization.currencyCode,
  };
}

// Exposes only the active organization; no organization id is accepted from the client.
@Controller('organization')
@UseGuards(TenantContextGuard, PermissionGuard)
export class OrganizationController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('current')
  @RequirePermissions(PERMISSIONS.ORGANIZATION.READ)
  async current(@CurrentTenant() tenant: TenantContext): Promise<OrganizationCurrentResponse> {
    const organization = await this.organizations.findCurrent(tenant.organizationId);
    return toOrganizationResponse(organization);
  }

  @Get('settings')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_SETTINGS.READ)
  async settings(@CurrentTenant() tenant: TenantContext): Promise<OrganizationCurrentResponse> {
    const organization = await this.organizations.findCurrent(tenant.organizationId);
    return toOrganizationResponse(organization);
  }

  @Patch('current')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_SETTINGS.UPDATE)
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: UpdateOrganizationDto,
  ): Promise<OrganizationCurrentResponse> {
    const organization = await this.organizations.updateCurrent(
      tenant.organizationId,
      tenant.membershipId,
      body,
    );
    return toOrganizationResponse(organization);
  }

  @Get('commercial-settings')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_SETTINGS.READ)
  async commercialSettings(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<CommercialSettingsResponse> {
    const settings = await this.organizations.findCommercialSettings(tenant.organizationId);
    if (!settings) throw resourceNotFound();
    return { currencyCode: settings.currencyCode, invoicePrefix: settings.invoicePrefix };
  }

  @Patch('commercial-settings')
  @RequirePermissions(PERMISSIONS.ORGANIZATION_SETTINGS.UPDATE)
  async updateCommercialSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: UpdateCommercialSettingsDto,
  ): Promise<CommercialSettingsResponse> {
    const settings = await this.organizations.updateCommercialSettings(
      tenant.organizationId,
      tenant.membershipId,
      body,
    );
    if (!settings) throw resourceNotFound();
    return { currencyCode: settings.currencyCode, invoicePrefix: settings.invoicePrefix };
  }
}
