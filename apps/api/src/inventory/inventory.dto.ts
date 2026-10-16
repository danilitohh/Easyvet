import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { InventoryItemStatus, InventoryItemType, InventoryMovementType } from '@prisma/client';

const DECIMAL = /^(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;
const POSITIVE_DECIMAL = /^(?=.*[1-9])(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;
const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Bounded query parameters protect the catalog and ledger endpoints from accidental unbounded reads.
export class InventoryItemListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsEnum(InventoryItemType)
  itemType?: InventoryItemType;

  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'])
  status: InventoryItemStatus | 'ALL' = InventoryItemStatus.ACTIVE;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

// Item writes expose only catalog metadata; tenant, status timestamps and stock stay server-controlled.
export class CreateInventoryItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string | null;

  @IsEnum(InventoryItemType)
  itemType!: InventoryItemType;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  baseUnit!: string;

  @IsOptional()
  @IsBoolean()
  lotTracking = false;

  @IsOptional()
  @IsString()
  @Matches(DECIMAL)
  minimumStock?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

// Metadata updates are partial; the service separately locks the item before enforcing lot-mode immutability.
export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string | null;

  @IsOptional()
  @IsEnum(InventoryItemType)
  itemType?: InventoryItemType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  baseUnit?: string;

  @IsOptional()
  @IsBoolean()
  lotTracking?: boolean;

  @IsOptional()
  @IsString()
  @Matches(DECIMAL)
  minimumStock?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

// Batch metadata can only be created atomically with a receipt in V1.
export class CreateInventoryBatchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lotNumber!: string;

  @IsOptional()
  @IsString()
  @Matches(CIVIL_DATE)
  expiryOn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

// Movement input accepts a positive quantity; the service assigns the signed delta from the operation type.
export class CreateInventoryMovementDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsUUID()
  clinicLocationId!: string;

  @IsIn(['RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'])
  movementType!: 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

  @IsString()
  @Matches(POSITIVE_DECIMAL)
  quantity!: string;

  @IsOptional()
  @IsUUID()
  inventoryBatchId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateInventoryBatchDto)
  newBatch?: CreateInventoryBatchDto;

  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string | null;

  @IsOptional()
  @IsString()
  @Matches(DECIMAL)
  unitCost?: string | null;
}

// Transfers bind both location endpoints and keep quantity positive before the atomic pair is recorded.
export class CreateInventoryTransferDto {
  @IsUUID()
  inventoryItemId!: string;

  @IsOptional()
  @IsUUID()
  inventoryBatchId?: string | null;

  @IsUUID()
  fromClinicLocationId!: string;

  @IsUUID()
  toClinicLocationId!: string;

  @IsString()
  @Matches(POSITIVE_DECIMAL)
  quantity!: string;

  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}

// Query boolean strings are parsed explicitly because Boolean("false") is true in JavaScript.
function parseQueryBoolean(value: unknown): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

// Location and item filters select one scope without silently changing the user's organization context.
export class InventoryStockQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsEnum(InventoryItemType)
  itemType?: InventoryItemType;

  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'])
  status?: InventoryItemStatus | 'ALL';

  @IsOptional()
  @Transform(({ value }) => parseQueryBoolean(value))
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseQueryBoolean(value))
  @IsBoolean()
  includeArchived = false;
}

// Ledger filters are bounded and use ISO instants so date ranges cannot shift with browser timezone.
export class InventoryMovementListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsUUID()
  inventoryBatchId?: string;

  @IsOptional()
  @IsEnum(InventoryMovementType)
  movementType?: InventoryMovementType;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  to?: string;
}
