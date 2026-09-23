import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { ReportRangeDto } from './reports.dto';
import { ReportsService } from './reports.service';

// Reports expose counts and currency-grouped aggregates only; patient and owner records stay private.
@Controller('reports')
@UseGuards(TenantContextGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('operational')
  @RequirePermissions(PERMISSIONS.REPORTS.OPERATIONAL)
  operational(@CurrentTenant() tenant: TenantContext, @Query() query: ReportRangeDto) {
    return this.reports.operational(tenant.organizationId, query);
  }

  @Get('clinical')
  @RequirePermissions(PERMISSIONS.REPORTS.CLINICAL)
  clinical(@CurrentTenant() tenant: TenantContext, @Query() query: ReportRangeDto) {
    return this.reports.clinical(tenant.organizationId, query);
  }

  @Get('commercial')
  @RequirePermissions(PERMISSIONS.REPORTS.COMMERCIAL)
  commercial(@CurrentTenant() tenant: TenantContext, @Query() query: ReportRangeDto) {
    return this.reports.commercial(tenant.organizationId, query);
  }

  @Get('inventory')
  @RequirePermissions(PERMISSIONS.REPORTS.INVENTORY)
  inventory(@CurrentTenant() tenant: TenantContext, @Query() query: ReportRangeDto) {
    return this.reports.inventory(tenant.organizationId, query);
  }
}
