import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AnesthesiaObservationListResponse,
  AnesthesiaObservationMutationResponse,
  AnesthesiaRecordDetail,
  AnesthesiaRecordListResponse,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  AnesthesiaObservationListQueryDto,
  AnesthesiaRecordListQueryDto,
  AnesthesiaRecordVersionDto,
  CreateAnesthesiaObservationDto,
  CreateAnesthesiaRecordDto,
  RemoveAnesthesiaObservationQueryDto,
  UpdateAnesthesiaObservationDto,
  UpdateAnesthesiaRecordDto,
  VoidAnesthesiaRecordDto,
} from './anesthesia.dto';
import { AnesthesiaService } from './anesthesia.service';

// Routes expose the anesthesia aggregate and keep monitoring rows behind parent version checks.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class AnesthesiaController {
  constructor(private readonly anesthesia: AnesthesiaService) {}

  @Get('patients/:patientId/anesthesia-records')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: AnesthesiaRecordListQueryDto,
  ): Promise<AnesthesiaRecordListResponse> {
    return this.anesthesia.listByPatient(tenant, patientId, query);
  }

  @Get('anesthesia-records/:anesthesiaRecordId')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('anesthesiaRecordId', new ParseUUIDPipe()) anesthesiaRecordId: string,
  ): Promise<AnesthesiaRecordDetail> {
    return this.anesthesia.findOne(tenant, anesthesiaRecordId);
  }

  @Post('clinical-encounters/:encounterId/anesthesia-records')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreateAnesthesiaRecordDto,
  ): Promise<AnesthesiaRecordDetail> {
    return this.anesthesia.create(tenant, encounterId, body);
  }

  @Patch('anesthesia-records/:anesthesiaRecordId')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_UPDATE_DRAFT)
  updateDraft(
    @CurrentTenant() tenant: TenantContext,
    @Param('anesthesiaRecordId', new ParseUUIDPipe()) anesthesiaRecordId: string,
    @Body() body: UpdateAnesthesiaRecordDto,
  ): Promise<AnesthesiaRecordDetail> {
    return this.anesthesia.updateDraft(tenant, anesthesiaRecordId, body);
  }

  @Post('anesthesia-records/:anesthesiaRecordId/finalize')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_FINALIZE)
  finalize(
    @CurrentTenant() tenant: TenantContext,
    @Param('anesthesiaRecordId', new ParseUUIDPipe()) anesthesiaRecordId: string,
    @Body() body: AnesthesiaRecordVersionDto,
  ): Promise<AnesthesiaRecordDetail> {
    return this.anesthesia.finalize(tenant, anesthesiaRecordId, body);
  }

  @Post('anesthesia-records/:anesthesiaRecordId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('anesthesiaRecordId', new ParseUUIDPipe()) anesthesiaRecordId: string,
    @Body() body: VoidAnesthesiaRecordDto,
  ): Promise<AnesthesiaRecordDetail> {
    return this.anesthesia.void(tenant, anesthesiaRecordId, body);
  }

  @Get('anesthesia-records/:anesthesiaRecordId/observations')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_READ)
  listObservations(
    @CurrentTenant() tenant: TenantContext,
    @Param('anesthesiaRecordId', new ParseUUIDPipe()) anesthesiaRecordId: string,
    @Query() query: AnesthesiaObservationListQueryDto,
  ): Promise<AnesthesiaObservationListResponse> {
    return this.anesthesia.listObservations(tenant, anesthesiaRecordId, query);
  }

  @Post('anesthesia-records/:anesthesiaRecordId/observations')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_UPDATE_DRAFT)
  createObservation(
    @CurrentTenant() tenant: TenantContext,
    @Param('anesthesiaRecordId', new ParseUUIDPipe()) anesthesiaRecordId: string,
    @Body() body: CreateAnesthesiaObservationDto,
  ): Promise<AnesthesiaObservationMutationResponse> {
    return this.anesthesia.createObservation(tenant, anesthesiaRecordId, body);
  }

  @Patch('anesthesia-records/:anesthesiaRecordId/observations/:observationId')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_UPDATE_DRAFT)
  updateObservation(
    @CurrentTenant() tenant: TenantContext,
    @Param('anesthesiaRecordId', new ParseUUIDPipe()) anesthesiaRecordId: string,
    @Param('observationId', new ParseUUIDPipe()) observationId: string,
    @Body() body: UpdateAnesthesiaObservationDto,
  ): Promise<AnesthesiaObservationMutationResponse> {
    return this.anesthesia.updateObservation(tenant, anesthesiaRecordId, observationId, body);
  }

  @Delete('anesthesia-records/:anesthesiaRecordId/observations/:observationId')
  @RequirePermissions(PERMISSIONS.CLINICAL.ANESTHESIA_UPDATE_DRAFT)
  removeObservation(
    @CurrentTenant() tenant: TenantContext,
    @Param('anesthesiaRecordId', new ParseUUIDPipe()) anesthesiaRecordId: string,
    @Param('observationId', new ParseUUIDPipe()) observationId: string,
    @Query() query: RemoveAnesthesiaObservationQueryDto,
  ): Promise<AnesthesiaObservationMutationResponse> {
    return this.anesthesia.removeObservation(tenant, anesthesiaRecordId, observationId, query);
  }
}
