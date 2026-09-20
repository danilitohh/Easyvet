import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { OwnerResponse, OwnersListResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PERMISSIONS } from '../authorization/permissions';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { CreateOwnerDto, OwnersQueryDto, UpdateOwnerDto } from './owner.dto';
import { OwnersService } from './owners.service';

type OwnerListItem = Awaited<ReturnType<OwnersService['listForOrganization']>>['items'][number];
type OwnerDetail = NonNullable<Awaited<ReturnType<OwnersService['findByIdForOrganization']>>>;
type OwnerResponseSource = OwnerListItem | OwnerDetail;

function toOwnerResponse(owner: OwnerResponseSource): OwnerResponse {
  return {
    id: owner.id,
    firstName: owner.firstName,
    lastName: owner.lastName,
    documentType: owner.documentType,
    documentNumber: owner.documentNumber,
    email: owner.email,
    phone: owner.phone,
    secondaryPhone: owner.secondaryPhone,
    address: owner.address,
    city: owner.city,
    notes: owner.notes,
    status: owner.status,
    archivedAt: owner.archivedAt?.toISOString() ?? null,
    createdAt: owner.createdAt.toISOString(),
    updatedAt: owner.updatedAt.toISOString(),
    ...('patients' in owner
      ? {
          patients: owner.patients.map((patient) => ({
            id: patient.id,
            name: patient.name,
            species: patient.species,
            status: patient.status,
          })),
        }
      : {}),
  };
}

function resourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

// Owner endpoints are tenant-scoped and expose only explicit safe response fields.
@Controller('owners')
@UseGuards(TenantContextGuard, PermissionGuard)
export class OwnersController {
  constructor(private readonly owners: OwnersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.OWNERS.READ)
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: OwnersQueryDto,
  ): Promise<OwnersListResponse> {
    const result = await this.owners.listForOrganization(tenant.organizationId, query);
    return {
      data: result.items.map((owner) => toOwnerResponse(owner)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  @Get(':ownerId')
  @RequirePermissions(PERMISSIONS.OWNERS.READ)
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('ownerId', new ParseUUIDPipe()) ownerId: string,
  ): Promise<OwnerResponse> {
    const owner = await this.owners.findByIdForOrganization(tenant.organizationId, ownerId);
    if (!owner) throw resourceNotFound();
    return toOwnerResponse(owner);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.OWNERS.CREATE)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateOwnerDto,
  ): Promise<OwnerResponse> {
    return toOwnerResponse(await this.owners.createForOrganization(tenant.organizationId, body));
  }

  @Patch(':ownerId')
  @RequirePermissions(PERMISSIONS.OWNERS.UPDATE)
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('ownerId', new ParseUUIDPipe()) ownerId: string,
    @Body() body: UpdateOwnerDto,
  ): Promise<OwnerResponse> {
    return toOwnerResponse(
      await this.owners.updateForOrganization(tenant.organizationId, ownerId, body),
    );
  }

  @Post(':ownerId/archive')
  @RequirePermissions(PERMISSIONS.OWNERS.ARCHIVE)
  async archive(
    @CurrentTenant() tenant: TenantContext,
    @Param('ownerId', new ParseUUIDPipe()) ownerId: string,
  ): Promise<OwnerResponse> {
    return toOwnerResponse(
      await this.owners.archiveForOrganization(tenant.organizationId, ownerId),
    );
  }
}
