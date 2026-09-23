import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ClinicLocationStatus,
  InventoryItemStatus,
  InventoryMovementType,
  Prisma,
} from '@prisma/client';
import type {
  CreateInventoryItemRequest,
  CreateInventoryMovementRequest,
  CreateInventoryTransferRequest,
  InventoryBatch,
  InventoryBatchListResponse,
  InventoryBatchSummary,
  InventoryDashboardSummary,
  InventoryItem,
  InventoryItemListQuery,
  InventoryItemListResponse,
  InventoryItemStockDetail,
  InventoryMovement,
  InventoryMovementListQuery,
  InventoryMovementListResponse,
  InventoryStockListResponse,
  InventoryStockQuery,
  InventoryTransferResponse,
  UpdateInventoryItemRequest,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';

type Transaction = Prisma.TransactionClient;
type InventoryDatabase = PrismaService | Transaction;

// Catalog responses never expose a Prisma Decimal instance or an unrelated tenant relation.
const itemSelect = {
  id: true,
  organizationId: true,
  name: true,
  sku: true,
  itemType: true,
  baseUnit: true,
  lotTracking: true,
  minimumStock: true,
  description: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InventoryItemSelect;

// Movement history returns only operational labels; it never exposes user email or contact data.
const movementInclude = {
  inventoryItem: { select: { name: true } },
  clinicLocation: { select: { name: true } },
  inventoryBatch: { select: { lotNumber: true } },
  createdByMembership: {
    select: {
      role: true,
      professionalProfile: { select: { displayName: true } },
    },
  },
} satisfies Prisma.InventoryMovementInclude;

type ItemRecord = Prisma.InventoryItemGetPayload<{ select: typeof itemSelect }>;
type MovementRecord = Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>;
type BalanceGroup = {
  inventoryItemId: string;
  clinicLocationId: string;
  stock: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);

// A consistent 404 avoids confirming whether a cross-tenant UUID exists.
function resourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

// Domain conflicts use stable public codes instead of database messages.
function inventoryConflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

// Decimal serialization remains exact and stable at the API boundary.
function decimalString(value: Prisma.Decimal | null): string | null {
  return value?.toString() ?? null;
}

// Civil expiry dates are serialized from PostgreSQL DATE at UTC midnight without local-time conversion.
function civilDateString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

// Full timestamps are represented as explicit UTC ISO instants for browsers and external clients.
function instantString(value: Date): string {
  return value.toISOString();
}

// Every Prisma item projection is mapped explicitly so no internal Decimal reaches JSON.
function toInventoryItem(item: ItemRecord): InventoryItem {
  return {
    id: item.id,
    organizationId: item.organizationId,
    name: item.name,
    sku: item.sku,
    itemType: item.itemType,
    baseUnit: item.baseUnit,
    lotTracking: item.lotTracking,
    minimumStock: decimalString(item.minimumStock),
    description: item.description,
    notes: item.notes,
    status: item.status,
    createdAt: instantString(item.createdAt),
    updatedAt: instantString(item.updatedAt),
  };
}

// Batch identities stay immutable; the response deliberately contains no editable stock field.
function toInventoryBatch(batch: {
  id: string;
  organizationId: string;
  inventoryItemId: string;
  lotNumber: string;
  expiryOn: Date | null;
  notes: string | null;
  createdAt: Date;
}): InventoryBatch {
  return {
    id: batch.id,
    organizationId: batch.organizationId,
    inventoryItemId: batch.inventoryItemId,
    lotNumber: batch.lotNumber,
    expiryOn: civilDateString(batch.expiryOn),
    notes: batch.notes,
    createdAt: instantString(batch.createdAt),
  };
}

// Movement responses retain signed ledger quantities while resolving only safe display names.
function toInventoryMovement(movement: MovementRecord): InventoryMovement {
  return {
    id: movement.id,
    organizationId: movement.organizationId,
    inventoryItemId: movement.inventoryItemId,
    clinicLocationId: movement.clinicLocationId,
    inventoryBatchId: movement.inventoryBatchId,
    movementType: movement.movementType,
    quantityDelta: movement.quantityDelta.toString(),
    occurredAt: instantString(movement.occurredAt),
    reason: movement.reason,
    reference: movement.reference,
    unitCost: decimalString(movement.unitCost),
    transferGroupId: movement.transferGroupId,
    createdByMembershipId: movement.createdByMembershipId,
    createdAt: instantString(movement.createdAt),
    inventoryItemName: movement.inventoryItem.name,
    clinicLocationName: movement.clinicLocation.name,
    batchLotNumber: movement.inventoryBatch?.lotNumber ?? null,
    actorDisplayName:
      movement.createdByMembership.professionalProfile?.displayName ??
      movement.createdByMembership.role.toLowerCase(),
  };
}

// A stable composite map key preserves each tenant/item/location balance independently.
function balanceKey(itemId: string, locationId: string): string {
  return `${itemId}:${locationId}`;
}

// Expiry warnings use the organization's civil date instead of the browser or database host timezone.
function organizationToday(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

// Civil date addition happens in UTC only as calendar arithmetic, not as an expiry timestamp conversion.
function addCivilDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Expiry labels are computed and never persisted as batch state.
function expiryStatus(
  expiryOn: string | null,
  today: string,
): InventoryBatchSummary['expiryStatus'] {
  if (!expiryOn) return 'NO_EXPIRY';
  if (expiryOn < today) return 'EXPIRED';
  if (expiryOn <= addCivilDays(today, 30)) return 'EXPIRING_SOON';
  return 'OK';
}

// Known unique conflicts are translated into a safe public response without exposing Prisma metadata.
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

// InventoryService owns quantity projection, row locking, tenant-safe writes and ledger serialization.
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // Lists catalog metadata by tenant with bounded search and stable ordering.
  async listItems(
    organizationId: string,
    query: InventoryItemListQuery,
  ): Promise<InventoryItemListResponse> {
    const where: Prisma.InventoryItemWhereInput = {
      organizationId,
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(query.itemType ? { itemType: query.itemType } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        select: itemSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);
    return {
      data: items.map(toInventoryItem),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  // Reads an item, including archived items, only inside the active tenant.
  async findItem(organizationId: string, itemId: string): Promise<InventoryItem> {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, organizationId },
      select: itemSelect,
    });
    if (!item) throw resourceNotFound();
    return toInventoryItem(item);
  }

  // Creates normalized metadata without initializing a mutable stock balance.
  async createItem(
    organizationId: string,
    input: CreateInventoryItemRequest,
  ): Promise<InventoryItem> {
    try {
      const item = await this.prisma.inventoryItem.create({
        data: {
          organizationId,
          name: input.name.trim(),
          sku: this.normalizeSku(input.sku),
          itemType: input.itemType,
          baseUnit: input.baseUnit.trim(),
          lotTracking: input.lotTracking,
          minimumStock: input.minimumStock ? new Prisma.Decimal(input.minimumStock) : null,
          description: this.normalizeText(input.description),
          notes: this.normalizeText(input.notes),
        },
        select: itemSelect,
      });
      return toInventoryItem(item);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw inventoryConflict('INVENTORY_SKU_EXISTS', 'An item with this SKU already exists');
      }
      throw error;
    }
  }

  // Updates item metadata under a row lock so the lot-tracking invariant cannot race a stock movement.
  async updateItem(
    organizationId: string,
    itemId: string,
    input: UpdateInventoryItemRequest,
  ): Promise<InventoryItem> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException({
        code: 'INVALID_INVENTORY_ITEM',
        message: 'No changes supplied',
      });
    }
    try {
      const item = await this.prisma.$transaction(async (tx) => {
        const current = await this.lockItem(tx, organizationId, itemId);
        if (current.status === InventoryItemStatus.ARCHIVED) {
          throw inventoryConflict('INVENTORY_ITEM_ARCHIVED', 'Archived items cannot be changed');
        }
        if (input.lotTracking !== undefined && input.lotTracking !== current.lotTracking) {
          const movementCount = await tx.inventoryMovement.count({
            where: { organizationId, inventoryItemId: itemId },
          });
          if (movementCount > 0) {
            throw inventoryConflict(
              'INVENTORY_LOT_TRACKING_IMMUTABLE',
              'Lot tracking cannot change after the item has stock history',
            );
          }
        }
        return tx.inventoryItem.update({
          where: { id: itemId },
          data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.sku !== undefined ? { sku: this.normalizeSku(input.sku) } : {}),
            ...(input.itemType !== undefined ? { itemType: input.itemType } : {}),
            ...(input.baseUnit !== undefined ? { baseUnit: input.baseUnit.trim() } : {}),
            ...(input.lotTracking !== undefined ? { lotTracking: input.lotTracking } : {}),
            ...(input.minimumStock !== undefined
              ? {
                  minimumStock:
                    input.minimumStock === null ? null : new Prisma.Decimal(input.minimumStock),
                }
              : {}),
            ...(input.description !== undefined
              ? { description: this.normalizeText(input.description) }
              : {}),
            ...(input.notes !== undefined ? { notes: this.normalizeText(input.notes) } : {}),
          },
          select: itemSelect,
        });
      });
      return toInventoryItem(item);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw inventoryConflict('INVENTORY_SKU_EXISTS', 'An item with this SKU already exists');
      }
      throw error;
    }
  }

  // Archival serializes with movements and requires the derived tenant-wide stock to be zero.
  async archiveItem(organizationId: string, itemId: string): Promise<InventoryItem> {
    return this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, organizationId, itemId);
      if (item.status === InventoryItemStatus.ARCHIVED) return toInventoryItem(item);
      const groups = await tx.inventoryMovement.groupBy({
        by: ['clinicLocationId'],
        where: { organizationId, inventoryItemId: itemId },
        _sum: { quantityDelta: true },
      });
      if (groups.some((group) => !(group._sum.quantityDelta ?? ZERO).isZero())) {
        throw inventoryConflict(
          'INVENTORY_ITEM_HAS_STOCK',
          'Reduce the item stock to zero at every location before archiving it',
        );
      }
      const archived = await tx.inventoryItem.update({
        where: { id: itemId },
        data: { status: InventoryItemStatus.ARCHIVED },
        select: itemSelect,
      });
      return toInventoryItem(archived);
    });
  }

  // Stock list computes balances from grouped ledger deltas and evaluates minimums per active location.
  async listStock(
    organizationId: string,
    query: InventoryStockQuery,
  ): Promise<InventoryStockListResponse> {
    if (query.clinicLocationId) {
      await this.requireLocationForRead(organizationId, query.clinicLocationId);
    }
    const where: Prisma.InventoryItemWhereInput = {
      organizationId,
      ...(query.includeArchived ? {} : { status: InventoryItemStatus.ACTIVE }),
      ...(query.itemType ? { itemType: query.itemType } : {}),
    };
    const items = await this.prisma.inventoryItem.findMany({
      where,
      select: itemSelect,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    if (items.length === 0) {
      return {
        data: [],
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: 0,
          totalPages: 0,
        },
      };
    }
    const locations = await this.prisma.clinicLocation.findMany({
      where: {
        organizationId,
        ...(query.clinicLocationId ? { id: query.clinicLocationId } : {}),
      },
      select: { id: true, name: true, status: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    const groups = await this.groupItemLocationBalances(
      this.prisma,
      organizationId,
      items.map((item) => item.id),
      query.clinicLocationId,
    );
    const balances = this.toItemLocationBalanceMap(groups);
    const activeLocations = locations.filter(
      (location) => location.status === ClinicLocationStatus.ACTIVE,
    );
    let rows = items.map((item) => {
      const stock = locations.reduce(
        (sum, location) => sum.plus(balances.get(balanceKey(item.id, location.id)) ?? ZERO),
        ZERO,
      );
      const minimum = item.minimumStock;
      const lowStockLocations =
        minimum === null
          ? 0
          : activeLocations.filter((location) =>
              (balances.get(balanceKey(item.id, location.id)) ?? ZERO).lte(minimum),
            ).length;
      return {
        item: toInventoryItem(item),
        stock: stock.toString(),
        lowStock: lowStockLocations > 0,
        lowStockLocations,
        clinicLocationId: query.clinicLocationId ?? null,
      };
    });
    if (query.lowStock !== undefined) {
      rows = rows.filter((row) => row.lowStock === query.lowStock);
    }
    const total = rows.length;
    const offset = (query.page - 1) * query.pageSize;
    return {
      data: rows.slice(offset, offset + query.pageSize),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  // A detail projection groups ledger rows by location and batch and derives local-date expiry labels.
  async itemStock(organizationId: string, itemId: string): Promise<InventoryItemStockDetail> {
    await this.requireItemForRead(organizationId, itemId);
    const [locations, batches, grouped, today] = await Promise.all([
      this.prisma.clinicLocation.findMany({
        where: { organizationId },
        select: { id: true, name: true, status: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.inventoryBatch.findMany({
        where: { organizationId, inventoryItemId: itemId },
        orderBy: [{ expiryOn: 'asc' }, { lotNumber: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.inventoryMovement.groupBy({
        by: ['clinicLocationId', 'inventoryBatchId'],
        where: { organizationId, inventoryItemId: itemId },
        _sum: { quantityDelta: true },
      }),
      this.getOrganizationToday(organizationId),
    ]);
    const locationBalances = new Map<string, Prisma.Decimal>();
    const batchLocationBalances = new Map<string, Prisma.Decimal>();
    let totalStock = ZERO;
    for (const group of grouped) {
      const amount = group._sum.quantityDelta ?? ZERO;
      totalStock = totalStock.plus(amount);
      const locationKey = group.clinicLocationId;
      locationBalances.set(locationKey, (locationBalances.get(locationKey) ?? ZERO).plus(amount));
      if (group.inventoryBatchId) {
        const key = `${group.inventoryBatchId}:${locationKey}`;
        batchLocationBalances.set(key, (batchLocationBalances.get(key) ?? ZERO).plus(amount));
      }
    }
    const item = await this.requireItemForRead(organizationId, itemId);
    const minimum = item.minimumStock;
    return {
      inventoryItemId: itemId,
      totalStock: totalStock.toString(),
      locations: locations.map((location) => {
        const stock = locationBalances.get(location.id) ?? ZERO;
        return {
          clinicLocationId: location.id,
          locationName: location.name,
          locationStatus: location.status,
          stock: stock.toString(),
          lowStock:
            minimum !== null &&
            location.status === ClinicLocationStatus.ACTIVE &&
            stock.lte(minimum),
        };
      }),
      batches: batches.map((batch) => {
        const batchLocations = locations.map((location) => ({
          clinicLocationId: location.id,
          locationName: location.name,
          locationStatus: location.status,
          stock: (batchLocationBalances.get(`${batch.id}:${location.id}`) ?? ZERO).toString(),
        }));
        const batchTotal = batchLocations.reduce((sum, location) => sum.plus(location.stock), ZERO);
        const expiryOn = civilDateString(batch.expiryOn);
        return {
          ...toInventoryBatch(batch),
          totalStock: batchTotal.toString(),
          locations: batchLocations,
          expiryStatus: expiryStatus(expiryOn, today),
        };
      }),
    };
  }

  // Batch reads are tenant/item scoped and keep creation inside a receipt operation.
  async listBatches(organizationId: string, itemId: string): Promise<InventoryBatchListResponse> {
    await this.requireItemForRead(organizationId, itemId);
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { organizationId, inventoryItemId: itemId },
      orderBy: [{ expiryOn: 'asc' }, { lotNumber: 'asc' }, { id: 'asc' }],
    });
    return { data: batches.map(toInventoryBatch) };
  }

  // Dashboard counters are lightweight projections over the catalog, active locations and grouped ledger.
  async dashboardSummary(organizationId: string): Promise<InventoryDashboardSummary> {
    const [items, locations, timezone] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: { organizationId, status: InventoryItemStatus.ACTIVE },
        select: { id: true, minimumStock: true },
      }),
      this.prisma.clinicLocation.findMany({
        where: { organizationId, status: ClinicLocationStatus.ACTIVE },
        select: { id: true },
      }),
      this.getOrganizationTimezone(organizationId),
    ]);
    let lowStockItemLocations = 0;
    if (items.length > 0 && locations.length > 0) {
      const groups = await this.groupItemLocationBalances(
        this.prisma,
        organizationId,
        items.map((item) => item.id),
      );
      const balances = this.toItemLocationBalanceMap(groups);
      for (const item of items) {
        if (item.minimumStock === null) continue;
        for (const location of locations) {
          if ((balances.get(balanceKey(item.id, location.id)) ?? ZERO).lte(item.minimumStock)) {
            lowStockItemLocations += 1;
          }
        }
      }
    }
    const today = organizationToday(timezone);
    const soon = addCivilDays(today, 30);
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        organizationId,
        expiryOn: { lte: new Date(`${soon}T00:00:00.000Z`) },
        inventoryItem: { status: InventoryItemStatus.ACTIVE },
      },
      select: { id: true, expiryOn: true },
    });
    const batchIds = batches.map((batch) => batch.id);
    const batchGroups =
      batchIds.length === 0
        ? []
        : await this.prisma.inventoryMovement.groupBy({
            by: ['inventoryBatchId'],
            where: { organizationId, inventoryBatchId: { in: batchIds } },
            _sum: { quantityDelta: true },
          });
    const batchBalances = new Map(
      batchGroups.map((group) => [group.inventoryBatchId, group._sum.quantityDelta ?? ZERO]),
    );
    let expiredBatches = 0;
    let expiringSoonBatches = 0;
    for (const batch of batches) {
      if ((batchBalances.get(batch.id) ?? ZERO).lte(0) || !batch.expiryOn) continue;
      const expiryOn = civilDateString(batch.expiryOn)!;
      if (expiryOn < today) expiredBatches += 1;
      else expiringSoonBatches += 1;
    }
    return {
      activeItems: items.length,
      lowStockItemLocations,
      expiredBatches,
      expiringSoonBatches,
    };
  }

  // Ledger history is immutable, tenant-filtered and stably ordered for deterministic pagination.
  async listMovements(
    organizationId: string,
    query: InventoryMovementListQuery,
  ): Promise<InventoryMovementListResponse> {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException({
        code: 'INVALID_INVENTORY_DATE_RANGE',
        message: 'The start time must be before the end time',
      });
    }
    const where: Prisma.InventoryMovementWhereInput = {
      organizationId,
      ...(query.inventoryItemId ? { inventoryItemId: query.inventoryItemId } : {}),
      ...(query.clinicLocationId ? { clinicLocationId: query.clinicLocationId } : {}),
      ...(query.inventoryBatchId ? { inventoryBatchId: query.inventoryBatchId } : {}),
      ...(query.movementType ? { movementType: query.movementType } : {}),
      ...(from || to
        ? { occurredAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    };
    const [movements, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: movementInclude,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);
    return {
      data: movements.map(toInventoryMovement),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  // A single manual movement locks the item, optional lot and location before calculating available stock.
  async createMovement(
    tenant: TenantContext,
    input: CreateInventoryMovementRequest,
  ): Promise<InventoryMovement> {
    if (input.unitCost && input.movementType !== 'RECEIPT') {
      throw new BadRequestException({
        code: 'INVALID_INVENTORY_MOVEMENT',
        message: 'Unit cost is only accepted for receipts',
      });
    }
    try {
      const movement = await this.prisma.$transaction(async (tx) => {
        const item = await this.lockItem(tx, tenant.organizationId, input.inventoryItemId);
        this.assertItemActive(item);
        const batchId = await this.resolveBatch(tx, tenant.organizationId, item, input);
        await this.lockActiveLocation(tx, tenant.organizationId, input.clinicLocationId);
        const amount = this.parsePositiveQuantity(input.quantity);
        const isOutbound =
          input.movementType === 'ISSUE' || input.movementType === 'ADJUSTMENT_OUT';
        const delta = isOutbound ? amount.negated() : amount;
        if (isOutbound) {
          await this.assertAvailableStock(
            tx,
            tenant.organizationId,
            item.id,
            input.clinicLocationId,
            batchId,
            amount,
          );
        }
        const reason = this.normalizeMovementReason(input.movementType, input.reason);
        const record = await tx.inventoryMovement.create({
          data: {
            organizationId: tenant.organizationId,
            inventoryItemId: item.id,
            clinicLocationId: input.clinicLocationId,
            inventoryBatchId: batchId,
            movementType: input.movementType as InventoryMovementType,
            quantityDelta: delta,
            occurredAt: new Date(input.occurredAt),
            reason,
            reference: this.normalizeText(input.reference),
            unitCost: input.unitCost ? new Prisma.Decimal(input.unitCost) : null,
            createdByMembershipId: tenant.membershipId,
          },
          include: movementInclude,
        });
        return toInventoryMovement(record);
      });
      return movement;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw inventoryConflict(
          'INVENTORY_BATCH_EXISTS',
          'That lot number already exists for this item',
        );
      }
      throw error;
    }
  }

  // Transfer locks both locations in lexical ID order and writes the out/in ledger pair atomically.
  async createTransfer(
    tenant: TenantContext,
    input: CreateInventoryTransferRequest,
  ): Promise<InventoryTransferResponse> {
    if (input.fromClinicLocationId === input.toClinicLocationId) {
      throw new BadRequestException({
        code: 'INVALID_INVENTORY_TRANSFER',
        message: 'Source and destination locations must differ',
      });
    }
    const transferGroupId = randomUUID();
    const movements = await this.prisma.$transaction(async (tx) => {
      const item = await this.lockItem(tx, tenant.organizationId, input.inventoryItemId);
      this.assertItemActive(item);
      const batchId = await this.resolveTransferBatch(
        tx,
        tenant.organizationId,
        item,
        input.inventoryBatchId,
      );
      const locationIds = [input.fromClinicLocationId, input.toClinicLocationId].sort();
      for (const locationId of locationIds) {
        await this.lockActiveLocation(tx, tenant.organizationId, locationId);
      }
      const amount = this.parsePositiveQuantity(input.quantity);
      await this.assertAvailableStock(
        tx,
        tenant.organizationId,
        item.id,
        input.fromClinicLocationId,
        batchId,
        amount,
      );
      const occurredAt = new Date(input.occurredAt);
      const reason = input.reason?.trim() || 'Transferencia entre sedes';
      const shared = {
        organizationId: tenant.organizationId,
        inventoryItemId: item.id,
        inventoryBatchId: batchId,
        occurredAt,
        reason,
        transferGroupId,
        createdByMembershipId: tenant.membershipId,
      };
      const transferOut = await tx.inventoryMovement.create({
        data: {
          ...shared,
          clinicLocationId: input.fromClinicLocationId,
          movementType: InventoryMovementType.TRANSFER_OUT,
          quantityDelta: amount.negated(),
        },
        include: movementInclude,
      });
      const transferIn = await tx.inventoryMovement.create({
        data: {
          ...shared,
          clinicLocationId: input.toClinicLocationId,
          movementType: InventoryMovementType.TRANSFER_IN,
          quantityDelta: amount,
        },
        include: movementInclude,
      });
      return [toInventoryMovement(transferOut), toInventoryMovement(transferIn)];
    });
    return { transferGroupId, movements };
  }

  // Locks one organization's item row before any calculation that can change its balance.
  private async lockItem(
    tx: Transaction,
    organizationId: string,
    itemId: string,
  ): Promise<ItemRecord> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM inventory_items WHERE organization_id = ${organizationId}::uuid AND id = ${itemId}::uuid FOR UPDATE`,
    );
    if (locked.length === 0) throw resourceNotFound();
    const item = await tx.inventoryItem.findFirst({
      where: { id: itemId, organizationId },
      select: itemSelect,
    });
    if (!item) throw resourceNotFound();
    return item;
  }

  // Row locking makes location deactivation and stock writes observe a serialized ACTIVE state.
  private async lockActiveLocation(
    tx: Transaction,
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM clinic_locations WHERE organization_id = ${organizationId}::uuid AND id = ${locationId}::uuid FOR UPDATE`,
    );
    if (locked.length === 0) throw resourceNotFound();
    const location = await tx.clinicLocation.findFirst({
      where: { id: locationId, organizationId },
      select: { status: true },
    });
    if (!location || location.status !== ClinicLocationStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'INVALID_INVENTORY_LOCATION',
        message: 'The location is not active for new inventory movements',
      });
    }
  }

  // Read-only filters may inspect inactive sites, but a foreign location remains an uninformative 404.
  private async requireLocationForRead(organizationId: string, locationId: string): Promise<void> {
    const location = await this.prisma.clinicLocation.findFirst({
      where: { id: locationId, organizationId },
      select: { id: true },
    });
    if (!location) throw resourceNotFound();
  }

  // Stock-changing writes require active catalog metadata; archived items remain readable only.
  private assertItemActive(item: ItemRecord): void {
    if (item.status === InventoryItemStatus.ARCHIVED) {
      throw inventoryConflict(
        'INVENTORY_ITEM_ARCHIVED',
        'Archived items cannot receive new movements',
      );
    }
  }

  // Receipt-time lot creation and existing-lot lookup share the same item lock and tenant boundary.
  private async resolveBatch(
    tx: Transaction,
    organizationId: string,
    item: ItemRecord,
    input: CreateInventoryMovementRequest,
  ): Promise<string | null> {
    if (!item.lotTracking) {
      if (input.inventoryBatchId || input.newBatch) {
        throw new BadRequestException({
          code: 'INVENTORY_BATCH_NOT_ALLOWED',
          message: 'This item does not track stock by lot',
        });
      }
      return null;
    }
    if (input.newBatch) {
      if (input.movementType !== 'RECEIPT') {
        throw new BadRequestException({
          code: 'INVENTORY_BATCH_NOT_ALLOWED',
          message: 'A lot can only be created with a receipt',
        });
      }
      const batch = await tx.inventoryBatch.create({
        data: {
          organizationId,
          inventoryItemId: item.id,
          lotNumber: input.newBatch.lotNumber.trim(),
          expiryOn: input.newBatch.expiryOn
            ? new Date(`${input.newBatch.expiryOn}T00:00:00.000Z`)
            : null,
          notes: this.normalizeText(input.newBatch.notes),
        },
      });
      return batch.id;
    }
    if (!input.inventoryBatchId) {
      throw new BadRequestException({
        code: 'INVENTORY_BATCH_REQUIRED',
        message: 'Select or create a lot before changing this item stock',
      });
    }
    await this.lockBatch(tx, organizationId, item.id, input.inventoryBatchId);
    return input.inventoryBatchId;
  }

  // Transfers never create a batch implicitly; a lot-controlled item must identify its existing lot.
  private async resolveTransferBatch(
    tx: Transaction,
    organizationId: string,
    item: ItemRecord,
    batchId: string | null | undefined,
  ): Promise<string | null> {
    if (!item.lotTracking) {
      if (batchId) {
        throw new BadRequestException({
          code: 'INVENTORY_BATCH_NOT_ALLOWED',
          message: 'This item does not track stock by lot',
        });
      }
      return null;
    }
    if (!batchId) {
      throw new BadRequestException({
        code: 'INVENTORY_BATCH_REQUIRED',
        message: 'Select a lot before transferring this item',
      });
    }
    await this.lockBatch(tx, organizationId, item.id, batchId);
    return batchId;
  }

  // Existing lots are locked after their item and validated by the composite tenant/item relation.
  private async lockBatch(
    tx: Transaction,
    organizationId: string,
    itemId: string,
    batchId: string,
  ): Promise<void> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM inventory_batches WHERE organization_id = ${organizationId}::uuid AND inventory_item_id = ${itemId}::uuid AND id = ${batchId}::uuid FOR UPDATE`,
    );
    if (locked.length === 0) {
      throw new NotFoundException({
        code: 'INVENTORY_BATCH_NOT_FOUND',
        message: 'Inventory batch not found',
      });
    }
  }

  // Positive decimal input is validated before conversion so binary floating point never enters stock math.
  private parsePositiveQuantity(value: string): Prisma.Decimal {
    const quantity = new Prisma.Decimal(value);
    if (!quantity.isFinite() || !quantity.gt(0) || quantity.decimalPlaces() > 6) {
      throw new BadRequestException({
        code: 'INVALID_INVENTORY_QUANTITY',
        message: 'Quantity must be greater than zero and use at most six decimal places',
      });
    }
    return quantity;
  }

  // Outbound writes check the exact item/site/lot projection while the shared item row remains locked.
  private async assertAvailableStock(
    tx: Transaction,
    organizationId: string,
    itemId: string,
    locationId: string,
    batchId: string | null,
    requested: Prisma.Decimal,
  ): Promise<void> {
    const aggregate = await tx.inventoryMovement.aggregate({
      where: {
        organizationId,
        inventoryItemId: itemId,
        clinicLocationId: locationId,
        inventoryBatchId: batchId,
      },
      _sum: { quantityDelta: true },
    });
    const available = aggregate._sum.quantityDelta ?? ZERO;
    if (available.lt(requested)) {
      throw inventoryConflict(
        'INSUFFICIENT_STOCK',
        'The available stock changed; refresh inventory and try again',
      );
    }
  }

  // Every non-receipt consumption/adjustment requires a human-readable reason.
  private normalizeMovementReason(
    movementType: CreateInventoryMovementRequest['movementType'],
    reason?: string | null,
  ): string {
    const normalized = reason?.trim();
    if (movementType !== 'RECEIPT' && !normalized) {
      throw new BadRequestException({
        code: 'INVENTORY_MOVEMENT_REASON_REQUIRED',
        message: 'A reason is required for issues and adjustments',
      });
    }
    return normalized || 'Recepción manual de inventario';
  }

  // SKU normalization is tenant-scoped and produces a stable case-insensitive uniqueness convention.
  private normalizeSku(value?: string | null): string | null {
    const normalized = value?.trim().toLocaleUpperCase('en-US');
    return normalized || null;
  }

  // Optional notes and references are stored as plain text, with whitespace-only values normalized to null.
  private normalizeText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized || null;
  }

  // A single groupBy helper is the only reusable path for per-item/per-location stock calculations.
  private async groupItemLocationBalances(
    database: InventoryDatabase,
    organizationId: string,
    inventoryItemIds: string[],
    clinicLocationId?: string,
  ): Promise<BalanceGroup[]> {
    if (inventoryItemIds.length === 0) return [];
    const executor = database as Prisma.TransactionClient;
    const locationFilter = clinicLocationId
      ? Prisma.sql`AND clinic_location_id = ${clinicLocationId}::uuid`
      : Prisma.empty;
    const itemIdList = Prisma.join(inventoryItemIds.map((id) => Prisma.sql`${id}::uuid`));
    return executor.$queryRaw<BalanceGroup[]>(Prisma.sql`
      SELECT inventory_item_id AS "inventoryItemId",
             clinic_location_id AS "clinicLocationId",
             SUM(quantity_delta) AS stock
      FROM inventory_movements
      WHERE organization_id = ${organizationId}::uuid
        AND inventory_item_id IN (${itemIdList})
        ${locationFilter}
      GROUP BY inventory_item_id, clinic_location_id
    `);
  }

  // Aggregate groups become exact composite-key balances for list and dashboard projections.
  private toItemLocationBalanceMap(groups: readonly BalanceGroup[]): Map<string, Prisma.Decimal> {
    return new Map(
      groups.map((group) => [
        balanceKey(group.inventoryItemId, group.clinicLocationId),
        group.stock,
      ]),
    );
  }

  // Item detail checks the tenant before any related data can be projected.
  private async requireItemForRead(organizationId: string, itemId: string): Promise<ItemRecord> {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id: itemId, organizationId },
      select: itemSelect,
    });
    if (!item) throw resourceNotFound();
    return item;
  }

  // The organization timezone is the sole authority for expiry warnings.
  private async getOrganizationTimezone(organizationId: string): Promise<string> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    if (!organization) throw resourceNotFound();
    return organization.timezone;
  }

  // Expiry and list data use a civil date in the tenant's configured timezone.
  private async getOrganizationToday(organizationId: string): Promise<string> {
    return organizationToday(await this.getOrganizationTimezone(organizationId));
  }
}
