import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { ConsentsService } from './consents.service';
import {
  CreateConsentDto,
  ExpectedVersionDto,
  UpdateConsentDraftDto,
  VoidConsentDto,
} from '../documents/documents.dto';

// Internal consent operations are scoped to the current tenant and explicit clinical-role permissions.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  @Get('patients/:patientId/consents')
  @RequirePermissions(PERMISSIONS.CLINICAL.CONSENTS_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
  ) {
    return this.consents.listByPatient(tenant, patientId);
  }

  @Get('consents/:consentId')
  @RequirePermissions(PERMISSIONS.CLINICAL.CONSENTS_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('consentId', new ParseUUIDPipe()) consentId: string,
  ) {
    return this.consents.findOne(tenant, consentId);
  }

  @Post('patients/:patientId/clinical-encounters/:encounterId/consents')
  @RequirePermissions(PERMISSIONS.CLINICAL.CONSENTS_CREATE)
  createDraft(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Param('encounterId', new ParseUUIDPipe()) encounterId: string,
    @Body() body: CreateConsentDto,
  ) {
    return this.consents.createDraft(tenant, patientId, encounterId, body);
  }

  @Patch('consents/:consentId')
  @RequirePermissions(PERMISSIONS.CLINICAL.CONSENTS_UPDATE_DRAFT)
  updateDraft(
    @CurrentTenant() tenant: TenantContext,
    @Param('consentId', new ParseUUIDPipe()) consentId: string,
    @Body() body: UpdateConsentDraftDto,
  ) {
    return this.consents.updateDraft(tenant, consentId, body);
  }

  @Post('consents/:consentId/issue')
  @RequirePermissions(PERMISSIONS.CLINICAL.CONSENTS_ISSUE)
  issue(
    @CurrentTenant() tenant: TenantContext,
    @Param('consentId', new ParseUUIDPipe()) consentId: string,
    @Body() body: ExpectedVersionDto,
  ) {
    return this.consents.issue(tenant, consentId, body.expectedVersion);
  }

  @Post('consents/:consentId/signature-request/reissue')
  @RequirePermissions(PERMISSIONS.CLINICAL.CONSENTS_ISSUE)
  reissue(
    @CurrentTenant() tenant: TenantContext,
    @Param('consentId', new ParseUUIDPipe()) consentId: string,
    @Body() body: ExpectedVersionDto,
  ) {
    return this.consents.reissue(tenant, consentId, body.expectedVersion);
  }

  @Post('consents/:consentId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.CONSENTS_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('consentId', new ParseUUIDPipe()) consentId: string,
    @Body() body: VoidConsentDto,
  ) {
    return this.consents.void(tenant, consentId, body.expectedVersion, body.reason);
  }
}
