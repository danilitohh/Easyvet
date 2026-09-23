import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import type { InvoiceDetail, InvoiceListResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PERMISSIONS } from '../authorization/permissions';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { InvoiceListQueryDto } from './commercial.dto';
import { InvoicesService } from './invoices.service';

// Billing routes are read-only; invoice state changes remain coupled to Sale void.
@Controller('invoices')
@UseGuards(TenantContextGuard, PermissionGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.BILLING.READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InvoiceListQueryDto,
  ): Promise<InvoiceListResponse> {
    return this.invoices.list(tenant.organizationId, query);
  }

  @Get(':invoiceId')
  @RequirePermissions(PERMISSIONS.BILLING.READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ): Promise<InvoiceDetail> {
    return this.invoices.findOne(tenant.organizationId, invoiceId);
  }
}
