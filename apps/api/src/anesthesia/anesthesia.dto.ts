import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AnesthesiaRecordStatus } from '@prisma/client';

// Record creation accepts only draft clinical fields; tenant, patient and lifecycle are server-owned.
export class CreateAnesthesiaRecordDto {
  @IsOptional()
  @IsUUID()
  clinicalProcedureId?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  startedAt?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  endedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  asaClassification?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  technique?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  preAnestheticAssessment?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  medicationsText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  airwayManagement?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  fluidsText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  complications?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  recoveryNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  responsiblePractitionerMembershipId?: string | null;
}

// Draft updates require an explicit observed parent version.
export class UpdateAnesthesiaRecordDto extends CreateAnesthesiaRecordDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;
}

export class AnesthesiaRecordVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;
}

export class VoidAnesthesiaRecordDto extends AnesthesiaRecordVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

// Patient history filters apply to startedAt; drafts without startedAt disappear under date filters.
export class AnesthesiaRecordListQueryDto {
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
  @IsEnum(AnesthesiaRecordStatus)
  status?: AnesthesiaRecordStatus;

  @IsOptional()
  @IsUUID()
  clinicalEncounterId?: string;

  @IsOptional()
  @IsUUID()
  clinicalProcedureId?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

// Observation list is separated from detail so the future UI can page monitoring data independently.
export class AnesthesiaObservationListQueryDto {
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

export class CreateAnesthesiaObservationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;

  @IsDateString({ strict: true })
  observedAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  heartRateBpm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  respiratoryRatePerMinute?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  temperatureC?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bloodPressureText?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  spo2Percent?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  etco2MmHg?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  anestheticPlane?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class UpdateAnesthesiaObservationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;

  @IsOptional()
  @IsDateString({ strict: true })
  observedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  heartRateBpm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  respiratoryRatePerMinute?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  temperatureC?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bloodPressureText?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  spo2Percent?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  etco2MmHg?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  anestheticPlane?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;
}

export class RemoveAnesthesiaObservationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;
}
