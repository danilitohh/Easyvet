import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsDateString,
  IsInt,
  IsOptional,
  IsNumber,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { HospitalizationEntryType, HospitalizationStatus } from '@prisma/client';

const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// Create requests accept only editable episode fields; tenant and audit IDs stay server-owned.
export class CreateHospitalizationDto {
  @IsOptional()
  @Matches(OFFSET_DATE_TIME)
  @IsDateString({ strict: true })
  admittedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  admissionReason?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  diagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  treatmentPlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  medicationsText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  dietInstructions?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  responsiblePractitionerMembershipId?: string | null;
}

// expectedVersion makes every mutable episode update a compare-and-swap operation.
export class UpdateHospitalizationDto extends CreateHospitalizationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class HospitalizationVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class DischargeHospitalizationDto extends HospitalizationVersionDto {
  @Matches(OFFSET_DATE_TIME)
  @IsDateString({ strict: true })
  dischargedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  dischargeSummary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  dischargeRecommendations?: string | null;
}

export class VoidHospitalizationDto extends HospitalizationVersionDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/\S/)
  @MaxLength(1000)
  reason!: string;
}

// Query parameters are bounded to prevent unbounded clinical-history reads.
export class HospitalizationListQueryDto {
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page = 1;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsEnum(HospitalizationStatus)
  status?: HospitalizationStatus;

  @IsOptional()
  @IsUUID()
  clinicalEncounterId?: string;

  @IsOptional()
  @Matches(OFFSET_DATE_TIME)
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @Matches(OFFSET_DATE_TIME)
  @IsDateString({ strict: true })
  to?: string;
}

export class HospitalizationEntriesQueryDto {
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
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

// Entry payload permits zero pulse/respiratory readings but positive physical measurements.
export class CreateHospitalizationEntryDto extends HospitalizationVersionDto {
  @IsEnum(HospitalizationEntryType)
  entryType!: HospitalizationEntryType;

  @Matches(OFFSET_DATE_TIME)
  @IsDateString({ strict: true })
  recordedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(Number.MIN_VALUE)
  temperatureC?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsInt()
  @Min(0)
  heartRateBpm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsInt()
  @Min(0)
  respiratoryRatePerMinute?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(Number.MIN_VALUE)
  weightKg?: number | null;
}
