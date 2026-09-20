import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { LocationResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { PERMISSIONS } from '../authorization/permissions';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { LocationsService } from './locations.service';

function resourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

function toLocationResponse(
  location: Awaited<ReturnType<LocationsService['findByIdForOrganization']>>,
): LocationResponse {
  if (!location) throw resourceNotFound();
  return {
    id: location.id,
    name: location.name,
    status: location.status,
    address: location.address,
    city: location.city,
  };
}

// Location reads always derive organizationId from TenantContext and never from query input.
@Controller('organization/locations')
@UseGuards(TenantContextGuard, PermissionGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.LOCATIONS.READ)
  async list(@CurrentTenant() tenant: TenantContext): Promise<LocationResponse[]> {
    const locations = await this.locations.findForOrganization(tenant.organizationId);
    return locations.map((location) => ({
      id: location.id,
      name: location.name,
      status: location.status,
      address: location.address,
      city: location.city,
    }));
  }

  @Get(':locationId')
  @RequirePermissions(PERMISSIONS.LOCATIONS.READ)
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('locationId', new ParseUUIDPipe()) locationId: string,
  ): Promise<LocationResponse> {
    const location = await this.locations.findByIdForOrganization(
      tenant.organizationId,
      locationId,
    );
    return toLocationResponse(location);
  }
}
