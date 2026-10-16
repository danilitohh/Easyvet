import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
import {
  CashMovementType,
  CashSessionStatus,
  InvoiceStatus,
  SaleItemType,
  SalePaymentMethod,
  SaleStatus,
} from '@prisma/client';

const MONEY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/;
const POSITIVE_MONEY = /^(?=.*[1-9])(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/;
const QUANTITY = /^(?=.*[1-9])(?:0|[1-9]\d{0,13})(?:\.\d{1,6})?$/;
const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// Pagination remains bounded for every commercial list, including ledger history.
abstract class PageQueryDto {
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
}

// Draft line inputs intentionally contain no snapshots, tenant ids, positions or totals.
export class SaleItemInputDto {
  @IsEnum(SaleItemType)
  itemType!: SaleItemType;

  @IsOptional()
  @IsUUID()
  inventoryItemId?: string | null;

  @IsOptional()
  @IsUUID()
  inventoryBatchId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @Matches(QUANTITY)
  quantity!: string;

  @IsString()
  @Matches(MONEY)
  unitPrice!: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY)
  discountAmount?: string;
}

// Sales accept only the clinic location, optional customer references and client-editable lines.
export class CreateSaleDto {
  @IsUUID()
  clinicLocationId!: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @IsOptional()
  @IsUUID()
  patientId?: string | null;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  @ArrayMaxSize(100)
  items?: SaleItemInputDto[];
}

// Draft replacement uses an explicit version so concurrent edits cannot overwrite one another.
export class UpdateSaleDto extends CreateSaleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

// Payment amounts are positive exact decimal strings; session ids are deliberately not accepted.
export class SalePaymentInputDto {
  @IsEnum(SalePaymentMethod)
  method!: SalePaymentMethod;

  @IsString()
  @Matches(POSITIVE_MONEY)
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string | null;
}

// Sale completion requires an expected version and an exact set of tender rows.
export class CompleteSaleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ValidateNested({ each: true })
  @Type(() => SalePaymentInputDto)
  @ArrayMaxSize(20)
  payments!: SalePaymentInputDto[];
}

// A completed sale can only be voided with a current version and a plain-text reason.
export class VoidSaleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

// Date and relationship filters are explicit and tenant-scoped by the service, never by the caller.
export class SaleListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(SaleStatus)
  status?: SaleStatus;

  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  to?: string;
}

// Invoice reads have simple exact/prefix number filtering rather than an unbounded search surface.
export class InvoiceListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  to?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  documentNumber?: string;
}

// Cash history can be filtered by location, state and an explicit instant range.
export class CashSessionListQueryDto extends PageQueryDto {
  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsEnum(CashSessionStatus)
  status?: CashSessionStatus;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  to?: string;
}

// Cash drawer history uses a bounded page so a long-lived session cannot create unbounded responses.
export class CashMovementListQueryDto extends PageQueryDto {}

// Opening cash is unsigned and the active location is checked again inside the transaction.
export class OpenCashSessionDto {
  @IsUUID()
  clinicLocationId!: string;

  @IsString()
  @Matches(MONEY)
  openingCashAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

// Manual cash inputs stay positive; the server derives the signed ledger delta from this enum.
export class CreateCashMovementDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsIn([CashMovementType.MANUAL_IN, CashMovementType.MANUAL_OUT])
  type!: CashMovementType;

  @IsString()
  @Matches(POSITIVE_MONEY)
  amount!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reference?: string | null;

  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  occurredAt!: string;
}

// Closing requires a current version and a nonnegative physical count; expected cash is recomputed.
export class CloseCashSessionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @Matches(MONEY)
  countedCashAmount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
