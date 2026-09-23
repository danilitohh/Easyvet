import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { SaleDetail, SaleListResponse } from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PERMISSIONS } from '../authorization/permissions';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CompleteSaleDto,
  CreateSaleDto,
  SaleListQueryDto,
  UpdateSaleDto,
  VoidSaleDto,
} from './commercial.dto';
import { SalesService } from './sales.service';

// Sales expose explicit lifecycle actions and no generic delete or completed-sale patch route.
@Controller('sales')
@UseGuards(TenantContextGuard, PermissionGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SALES.READ)
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SaleListQueryDto,
  ): Promise<SaleListResponse> {
    return this.sales.list(tenant.organizationId, query);
  }

  @Get(':saleId')
  @RequirePermissions(PERMISSIONS.SALES.READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('saleId', new ParseUUIDPipe()) saleId: string,
  ): Promise<SaleDetail> {
    return this.sales.findOne(tenant.organizationId, saleId);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.SALES.CREATE)
  create(@CurrentTenant() tenant: TenantContext, @Body() body: CreateSaleDto): Promise<SaleDetail> {
    return this.sales.create(tenant, body);
  }

  @Patch(':saleId')
  @RequirePermissions(PERMISSIONS.SALES.UPDATE_DRAFT)
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('saleId', new ParseUUIDPipe()) saleId: string,
    @Body() body: UpdateSaleDto,
  ): Promise<SaleDetail> {
    return this.sales.update(tenant, saleId, body);
  }

  @Post(':saleId/complete')
  @RequirePermissions(PERMISSIONS.SALES.COMPLETE)
  complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('saleId', new ParseUUIDPipe()) saleId: string,
    @Body() body: CompleteSaleDto,
  ): Promise<SaleDetail> {
    return this.sales.complete(tenant, saleId, body);
  }

  @Post(':saleId/void')
  @RequirePermissions(PERMISSIONS.SALES.VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('saleId', new ParseUUIDPipe()) saleId: string,
    @Body() body: VoidSaleDto,
  ): Promise<SaleDetail> {
    return this.sales.void(tenant, saleId, body);
  }
}
