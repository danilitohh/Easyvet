import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ClinicalFollowUpStatus } from '@prisma/client';

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// List queries are bounded and explicit so the operational queue cannot request unbounded data.
export class ClinicalFollowUpListQueryDto {
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
  @IsEnum(ClinicalFollowUpStatus)
  status?: ClinicalFollowUpStatus;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  assignedMembershipId?: string;

  @IsOptional()
  @IsUUID()
  sourceClinicalEncounterId?: string;

  @IsOptional()
  @Matches(CIVIL_DATE)
  dueFrom?: string;

  @IsOptional()
  @Matches(CIVIL_DATE)
  dueTo?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  reminderBefore?: string;

  @IsOptional()
  @IsIn(['due_asc', 'due_desc', 'created_desc'])
  sort: 'due_asc' | 'due_desc' | 'created_desc' = 'due_asc';
}

// Create writes accept only user-managed task content; tenant and lifecycle fields are server-owned.
export class CreateClinicalFollowUpDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  reason?: string | null;

  @IsString()
  @Matches(CIVIL_DATE)
  dueOn!: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  reminderAt?: string | null;

  @IsOptional()
  @IsUUID()
  assignedMembershipId?: string | null;

  @IsOptional()
  @IsUUID()
  sourceClinicalEncounterId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;
}

// Updates require a CAS version and expose no status, actor, snapshot, or audit controls.
export class UpdateClinicalFollowUpDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  reason?: string | null;

  @IsOptional()
  @Matches(CIVIL_DATE)
  dueOn?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(OFFSET_DATE_TIME)
  reminderAt?: string | null;

  @IsOptional()
  @IsUUID()
  assignedMembershipId?: string | null;

  @IsOptional()
  @IsUUID()
  sourceClinicalEncounterId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;
}

// Completion evidence is recorded by the server and the clinical Practitioner performing it.
export class CompleteClinicalFollowUpDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  outcome!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  completionNotes?: string | null;
}

// Voiding preserves the clinical task and requires a reason plus the version the actor reviewed.
export class VoidClinicalFollowUpDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  reason!: string;
}
