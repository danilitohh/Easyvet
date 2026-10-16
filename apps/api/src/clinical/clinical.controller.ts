import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  ClinicalEncounterListResponse,
  ClinicalEncounterResponse,
  ClinicalEvolutionListResponse,
  ClinicalEvolutionResponse,
  ClinicalRecordEnvelope,
  ClinicalVitalListResponse,
  ClinicalVitalResponse,
  ClinicalPractitionerListResponse,
  ClinicalMemberListResponse,
  ProfessionalProfileResponse,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PERMISSIONS } from '../authorization/permissions';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  ClinicalEncounterQueryDto,
  ClinicalEncounterVersionDto,
  ClinicalVitalQueryDto,
  CreateClinicalEncounterDto,
  CreateClinicalEvolutionDto,
  CreateClinicalVitalDto,
  ClinicalEvolutionQueryDto,
  UpdateClinicalEncounterDto,
  VoidClinicalEncounterDto,
  UpsertProfessionalProfileDto,
} from './clinical.dto';
import { ClinicalService } from './clinical.service';

// Clinical routes are deliberately segmented; no endpoint returns a whole patient history tree.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class ClinicalController {
  constructor(private readonly clinical: ClinicalService) {}

  @Get('clinical/me/professional-profile')
  @RequirePermissions(PERMISSIONS.CLINICAL.RECORDS_READ)
  getProfessionalProfile(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<ProfessionalProfileResponse> {
    return this.clinical.getProfessionalProfile(tenant);
  }

  @Put('clinical/me/professional-profile')
  @RequirePermissions(PERMISSIONS.CLINICAL.RECORDS_READ)
  upsertProfessionalProfile(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: UpsertProfessionalProfileDto,
  ): Promise<ProfessionalProfileResponse> {
    return this.clinical.upsertProfessionalProfile(tenant, body);
  }

  @Get('clinical/practitioners')
  @RequirePermissions(PERMISSIONS.CLINICAL.ENCOUNTERS_CREATE)
  listPractitioners(
    @CurrentTenant() tenant: TenantContext,
  ): Promise<ClinicalPractitionerListResponse> {
    return this.clinical.listPractitioners(tenant);
  }

  @Get('clinical/members')
  @RequirePermissions(PERMISSIONS.CLINICAL.RECORDS_READ)
  listClinicalMembers(@CurrentTenant() tenant: TenantContext): Promise<ClinicalMemberListResponse> {
    return this.clinical.listClinicalMembers(tenant);
  }

  @Get('patients/:patientId/clinical-record')
  @RequirePermissions(PERMISSIONS.CLINICAL.RECORDS_READ)
  async getRecord(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
  ): Promise<ClinicalRecordEnvelope> {
    return { clinicalRecord: await this.clinical.getRecord(tenant, patientId) };
  }

  @Get('patients/:patientId/clinical-encounters')
  @RequirePermissions(PERMISSIONS.CLINICAL.ENCOUNTERS_READ)
  listEncounters(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: ClinicalEncounterQueryDto,
  ): Promise<ClinicalEncounterListResponse> {
    return this.clinical.listEncounters(tenant, patientId, query);
  }

  @Post('patients/:patientId/clinical-encounters')
  @RequirePermissions(PERMISSIONS.CLINICAL.ENCOUNTERS_CREATE)
  createEncounter(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateClinicalEncounterDto,
  ): Promise<ClinicalEncounterResponse> {
    return this.clinical.createEncounter(tenant, patientId, body);
  }

  @Get('clinical-encounters/:encounterId')
  @RequirePermissions(PERMISSIONS.CLINICAL.ENCOUNTERS_READ)
  findEncounter(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
  ): Promise<ClinicalEncounterResponse> {
    return this.clinical.findEncounter(tenant, encounterId);
  }

  @Patch('clinical-encounters/:encounterId')
  @RequirePermissions(PERMISSIONS.CLINICAL.ENCOUNTERS_UPDATE_DRAFT)
  updateEncounter(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: UpdateClinicalEncounterDto,
  ): Promise<ClinicalEncounterResponse> {
    return this.clinical.updateEncounter(tenant, encounterId, body);
  }

  @Get('clinical-encounters/:encounterId/vitals')
  @RequirePermissions(PERMISSIONS.CLINICAL.VITALS_READ)
  async listVitals(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Query() query: ClinicalVitalQueryDto,
  ): Promise<ClinicalVitalListResponse> {
    return this.clinical.listVitals(tenant, encounterId, query);
  }

  @Post('clinical-encounters/:encounterId/vitals')
  @RequirePermissions(PERMISSIONS.CLINICAL.VITALS_CREATE)
  addVital(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreateClinicalVitalDto,
  ): Promise<ClinicalVitalResponse> {
    return this.clinical.addVital(tenant, encounterId, body);
  }

  @Post('clinical-encounters/:encounterId/finalize')
  @RequirePermissions(PERMISSIONS.CLINICAL.ENCOUNTERS_FINALIZE)
  finalizeEncounter(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: ClinicalEncounterVersionDto,
  ): Promise<ClinicalEncounterResponse> {
    return this.clinical.finalizeEncounter(tenant, encounterId, body);
  }

  @Post('clinical-encounters/:encounterId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.ENCOUNTERS_VOID)
  voidEncounter(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: VoidClinicalEncounterDto,
  ): Promise<ClinicalEncounterResponse> {
    return this.clinical.voidEncounter(tenant, encounterId, body);
  }

  @Get('patients/:patientId/clinical-evolutions')
  @RequirePermissions(PERMISSIONS.CLINICAL.EVOLUTIONS_READ)
  listEvolutions(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: ClinicalEvolutionQueryDto,
  ): Promise<ClinicalEvolutionListResponse> {
    return this.clinical.listEvolutions(tenant, patientId, query);
  }

  @Post('patients/:patientId/clinical-evolutions')
  @RequirePermissions(PERMISSIONS.CLINICAL.EVOLUTIONS_CREATE)
  addEvolution(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() body: CreateClinicalEvolutionDto,
  ): Promise<ClinicalEvolutionResponse> {
    return this.clinical.addEvolution(tenant, patientId, body);
  }
}
