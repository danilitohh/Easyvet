import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { GroomingVisitStatus } from '@prisma/client';

const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// Queue queries stay bounded and accept only explicit tenant-scoped filters.
export class GroomingVisitListQueryDto {
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
  @IsEnum(GroomingVisitStatus)
  status?: GroomingVisitStatus;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsUUID()
  assignedGroomerMembershipId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  to?: string;
}

// Groomer options are a searchable, bounded tenant-local reference list.
export class GroomingGroomerListQueryDto {
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
  @IsString()
  @MaxLength(160)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  search?: string;
}

// Tenant, owner, status, version, snapshots and audit fields are always server controlled.
export class CreateGroomingVisitDto {
  @IsUUID()
  clinicLocationId!: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @IsOptional()
  @IsUUID()
  assignedGroomerMembershipId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  serviceSummary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  coatCondition?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  skinObservations?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  temperamentNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  preServiceNotes?: string | null;
}

// Drafts allow intake changes; active visits expose operational notes only at service time.
export class UpdateGroomingVisitDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @IsOptional()
  @IsUUID()
  assignedGroomerMembershipId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  serviceSummary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  coatCondition?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  skinObservations?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  temperamentNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  preServiceNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  postServiceNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  incidentNotes?: string | null;
}

// Explicit action bodies prevent clients from manufacturing timestamps, actor IDs or snapshots.
export class StartGroomingVisitDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CompleteGroomingVisitDto extends StartGroomingVisitDto {
  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  postServiceNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5_000)
  incidentNotes?: string | null;
}

export class VoidGroomingVisitDto extends StartGroomingVisitDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1_000)
  reason!: string;
}
