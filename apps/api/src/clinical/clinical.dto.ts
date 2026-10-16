import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
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
import { ClinicalEncounterStatus } from '@prisma/client';

// Profile writes accept only tenant-local professional data; identity and tenant fields are
// always resolved from the authenticated membership by ClinicalService.
export class UpsertProfessionalProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  licenseNumber?: string | null;
}

// Clinical writes intentionally expose only editable clinical fields; tenant, audit and lifecycle
// fields are always derived by the service from the authenticated context and database state.
export class CreateClinicalEncounterDto {
  @IsUUID()
  clinicLocationId!: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string | null;

  @IsOptional()
  @IsUUID()
  responsibleMembershipId?: string | null;

  @IsISO8601({ strict: true })
  occurredAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  anamnesis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  physicalExam?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  presumptiveDiagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  differentialDiagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  definitiveDiagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  diagnosticPlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  therapeuticPlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  recommendations?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  followUpPlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;
}

// Draft updates use the same editable field surface but require an explicit optimistic version.
export class UpdateClinicalEncounterDto {
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
  responsibleMembershipId?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  anamnesis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  physicalExam?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  presumptiveDiagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  differentialDiagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  definitiveDiagnosis?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  diagnosticPlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  therapeuticPlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  recommendations?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  followUpPlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;
}

export class ClinicalEncounterVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class VoidClinicalEncounterDto extends ClinicalEncounterVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  reason!: string;
}

export class CreateClinicalVitalDto {
  @IsISO8601({ strict: true })
  measuredAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.001)
  weightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.001)
  temperatureC?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  heartRateBpm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  respiratoryRateBpm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bodyCondition?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  hydration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mucousMembranes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  skinTurgor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  observations?: string | null;
}

// Vital history is bounded per request so one encounter cannot produce an unbounded response.
export class ClinicalVitalQueryDto {
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
  pageSize = 100;
}

export class ClinicalEncounterQueryDto {
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
  @IsEnum(ClinicalEncounterStatus)
  status?: ClinicalEncounterStatus;

  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @IsOptional()
  @IsUUID()
  responsibleMembershipId?: string;
}

export class CreateClinicalEvolutionDto {
  @IsOptional()
  @IsUUID()
  clinicalEncounterId?: string | null;

  @IsISO8601({ strict: true })
  occurredAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  subjective?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  objective?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  assessment?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  plan?: string | null;
}

export class ClinicalEvolutionQueryDto {
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
  @IsISO8601({ strict: true })
  from?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
