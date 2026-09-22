import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ClinicalProcedureKind, ClinicalProcedureStatus } from '@prisma/client';

// Surgery detail is nested because it has no independent endpoint or lifecycle.
export class ClinicalSurgeryDetailInputDto {
  @IsOptional()
  @IsUUID()
  assistantMembershipId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  surgicalArea?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  surgicalSide?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  bleedingNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  closureNotes?: string | null;
}

// Creation accepts only editable draft fields; tenant and lifecycle fields are server-derived.
export class CreateClinicalProcedureDto {
  @IsEnum(ClinicalProcedureKind)
  kind!: ClinicalProcedureKind;

  @IsOptional()
  @IsUUID()
  responsiblePractitionerMembershipId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  procedureName?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  performedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  indication?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  technique?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  findings?: string | null;

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
  postoperativePlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClinicalSurgeryDetailInputDto)
  surgeryDetail?: ClinicalSurgeryDetailInputDto | null;
}

// Draft updates require an optimistic version and may change only explicitly supplied fields.
export class UpdateClinicalProcedureDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;

  @IsOptional()
  @IsEnum(ClinicalProcedureKind)
  kind?: ClinicalProcedureKind;

  @IsOptional()
  @IsUUID()
  responsiblePractitionerMembershipId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  procedureName?: string | null;

  @IsOptional()
  @IsDateString({ strict: true })
  performedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  indication?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  technique?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  findings?: string | null;

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
  postoperativePlan?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClinicalSurgeryDetailInputDto)
  surgeryDetail?: ClinicalSurgeryDetailInputDto | null;
}

// Finalize and void transitions share an explicit client-observed version.
export class ClinicalProcedureVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;
}

export class VoidClinicalProcedureDto extends ClinicalProcedureVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

// Patient history filters are bounded and applied to performedAt, including nullable draft dates.
export class ClinicalProcedureListQueryDto {
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
  @IsEnum(ClinicalProcedureStatus)
  status?: ClinicalProcedureStatus;

  @IsOptional()
  @IsEnum(ClinicalProcedureKind)
  kind?: ClinicalProcedureKind;

  @IsOptional()
  @IsUUID()
  clinicalEncounterId?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}
