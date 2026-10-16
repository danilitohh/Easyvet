import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateInventoryItemRequest,
  CreateInventoryMovementRequest,
  CreateInventoryTransferRequest,
  InventoryBatchListResponse,
  InventoryBatchListQuery,
  InventoryDashboardSummary,
  InventoryItem,
  InventoryItemListQuery,
  InventoryItemListResponse,
  InventoryItemStockDetail,
  InventoryMovementListQuery,
  InventoryMovementListResponse,
  InventoryStockListResponse,
  InventoryStockQuery,
  InventoryTransferResponse,
  UpdateInventoryItemRequest,
} from '@veterinary-saas/contracts';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PERMISSIONS, hasPermissions } from '../authorization/permissions';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  CreateInventoryItemDto,
  CreateInventoryMovementDto,
  CreateInventoryTransferDto,
  InventoryItemListQueryDto,
  InventoryMovementListQueryDto,
  InventoryBatchListQueryDto,
  InventoryStockQueryDto,
  UpdateInventoryItemDto,
} from './inventory.dto';
import { InventoryService } from './inventory.service';

// Every inventory endpoint requires an active tenant context; PLATFORM_ADMIN has no cross-tenant bypass.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('inventory/summary')
  @RequirePermissions(PERMISSIONS.INVENTORY.READ)
  summary(@CurrentTenant() tenant: TenantContext): Promise<InventoryDashboardSummary> {
    return this.inventory.dashboardSummary(tenant.organizationId);
  }

  @Get('inventory/items')
  @RequirePermissions(PERMISSIONS.INVENTORY.READ)
  listItems(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InventoryItemListQueryDto,
  ): Promise<InventoryItemListResponse> {
    return this.inventory.listItems(tenant.organizationId, query as InventoryItemListQuery);
  }

  @Get('inventory/items/:itemId/stock')
  @RequirePermissions(PERMISSIONS.INVENTORY.READ)
  itemStock(
    @CurrentTenant() tenant: TenantContext,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Query() query: InventoryBatchListQueryDto,
  ): Promise<InventoryItemStockDetail> {
    return this.inventory.itemStock(
      tenant.organizationId,
      itemId,
      query as InventoryBatchListQuery,
    );
  }

  @Get('inventory/items/:itemId/batches')
  @RequirePermissions(PERMISSIONS.INVENTORY.READ)
  batches(
    @CurrentTenant() tenant: TenantContext,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Query() query: InventoryBatchListQueryDto,
  ): Promise<InventoryBatchListResponse> {
    return this.inventory.listBatches(
      tenant.organizationId,
      itemId,
      query as InventoryBatchListQuery,
    );
  }

  @Get('inventory/items/:itemId')
  @RequirePermissions(PERMISSIONS.INVENTORY.READ)
  findItem(
    @CurrentTenant() tenant: TenantContext,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ): Promise<InventoryItem> {
    return this.inventory.findItem(tenant.organizationId, itemId);
  }

  @Post('inventory/items')
  @RequirePermissions(PERMISSIONS.INVENTORY.ITEMS_CREATE)
  createItem(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateInventoryItemDto,
  ): Promise<InventoryItem> {
    return this.inventory.createItem(tenant.organizationId, body as CreateInventoryItemRequest);
  }

  @Patch('inventory/items/:itemId')
  @RequirePermissions(PERMISSIONS.INVENTORY.ITEMS_UPDATE)
  updateItem(
    @CurrentTenant() tenant: TenantContext,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() body: UpdateInventoryItemDto,
  ): Promise<InventoryItem> {
    return this.inventory.updateItem(
      tenant.organizationId,
      itemId,
      body as UpdateInventoryItemRequest,
    );
  }

  @Post('inventory/items/:itemId/archive')
  @RequirePermissions(PERMISSIONS.INVENTORY.ITEMS_ARCHIVE)
  archiveItem(
    @CurrentTenant() tenant: TenantContext,
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
  ): Promise<InventoryItem> {
    return this.inventory.archiveItem(tenant.organizationId, itemId);
  }

  @Get('inventory/stock')
  @RequirePermissions(PERMISSIONS.INVENTORY.READ)
  stock(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InventoryStockQueryDto,
  ): Promise<InventoryStockListResponse> {
    return this.inventory.listStock(tenant.organizationId, query as InventoryStockQuery);
  }

  @Get('inventory/movements')
  @RequirePermissions(PERMISSIONS.INVENTORY.READ)
  movements(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: InventoryMovementListQueryDto,
  ): Promise<InventoryMovementListResponse> {
    return this.inventory.listMovements(tenant.organizationId, query as InventoryMovementListQuery);
  }

  @Post('inventory/movements')
  @RequirePermissions(PERMISSIONS.INVENTORY.MOVEMENTS_CREATE)
  createMovement(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateInventoryMovementDto,
  ): Promise<InventoryMovementListResponse['data'][number]> {
    if (
      (body.movementType === 'ADJUSTMENT_IN' || body.movementType === 'ADJUSTMENT_OUT') &&
      !hasPermissions(tenant.role, tenant.clinicalRole, [PERMISSIONS.INVENTORY.ADJUSTMENTS_CREATE])
    ) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Insufficient permission',
      });
    }
    return this.inventory.createMovement(tenant, body as CreateInventoryMovementRequest);
  }

  @Post('inventory/transfers')
  @RequirePermissions(PERMISSIONS.INVENTORY.TRANSFERS_CREATE)
  createTransfer(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateInventoryTransferDto,
  ): Promise<InventoryTransferResponse> {
    return this.inventory.createTransfer(tenant, body as CreateInventoryTransferRequest);
  }
}
