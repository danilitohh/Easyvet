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
import type { PatientResponse, PatientsListResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PERMISSIONS } from '../authorization/permissions';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { CreatePatientDto, PatientsQueryDto, UpdatePatientDto } from './patient.dto';
import { PatientsService } from './patients.service';

type PatientRecord = NonNullable<Awaited<ReturnType<PatientsService['findByIdForOrganization']>>>;
type PatientListItem = Awaited<ReturnType<PatientsService['listForOrganization']>>['items'][number];

function resourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

function toPatientResponse(patient: PatientRecord | PatientListItem): PatientResponse {
  return {
    id: patient.id,
    ownerId: patient.ownerId,
    name: patient.name,
    species: patient.species,
    breed: patient.breed,
    sex: patient.sex,
    birthDate: patient.birthDate?.toISOString().slice(0, 10) ?? null,
    birthDateEstimated: patient.birthDateEstimated,
    color: patient.color,
    microchipNumber: patient.microchipNumber,
    currentWeightKg: patient.currentWeightKg,
    sterilized: patient.sterilized,
    notes: patient.notes,
    status: patient.status,
    archivedAt: patient.archivedAt?.toISOString() ?? null,
    createdAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
    owner: {
      id: patient.owner.id,
      firstName: patient.owner.firstName,
      lastName: patient.owner.lastName,
      email: patient.owner.email,
      phone: patient.owner.phone,
      status: patient.owner.status,
    },
  };
}

// Patient endpoints use the active tenant and never trust owner or organization ids from the client.
@Controller('patients')
@UseGuards(TenantContextGuard, PermissionGuard)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PATIENTS.READ)
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PatientsQueryDto,
  ): Promise<PatientsListResponse> {
    const result = await this.patients.listForOrganization(tenant.organizationId, query);
    return {
      data: result.items.map((patient) => toPatientResponse(patient)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  @Get(':patientId')
  @RequirePermissions(PERMISSIONS.PATIENTS.READ)
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
  ): Promise<PatientResponse> {
    const patient = await this.patients.findByIdForOrganization(tenant.organizationId, patientId);
    if (!patient) throw resourceNotFound();
    return toPatientResponse(patient);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PATIENTS.CREATE)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreatePatientDto,
  ): Promise<PatientResponse> {
    return toPatientResponse(
      await this.patients.createForOrganization(tenant.organizationId, body),
    );
  }

  @Patch(':patientId')
  @RequirePermissions(PERMISSIONS.PATIENTS.UPDATE)
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() body: UpdatePatientDto,
  ): Promise<PatientResponse> {
    return toPatientResponse(
      await this.patients.updateForOrganization(tenant.organizationId, patientId, body),
    );
  }

  @Post(':patientId/archive')
  @RequirePermissions(PERMISSIONS.PATIENTS.ARCHIVE)
  async archive(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
  ): Promise<PatientResponse> {
    return toPatientResponse(
      await this.patients.archiveForOrganization(tenant.organizationId, patientId),
    );
  }
}
