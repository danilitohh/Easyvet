import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  IsString,
} from 'class-validator';
import { PreventiveRecordStatus } from '@prisma/client';

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Vaccination fields remain optional in a draft and become required only at finalization.
export class CreateVaccinationDto {
  @IsOptional()
  @Matches(CIVIL_DATE)
  administeredOn?: string | null;

  @IsOptional()
  @Matches(CIVIL_DATE)
  nextDueOn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vaccineName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vaccineType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  route?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  laboratoryName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  lotNumber?: string | null;

  @IsOptional()
  @Matches(CIVIL_DATE)
  expiryOn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  doseText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  responsiblePractitionerMembershipId?: string | null;

  @IsOptional()
  @IsUUID()
  administeredByMembershipId?: string | null;
}

// Draft updates use explicit optional keys so null can clear an existing optional value.
export class UpdateVaccinationDto extends CreateVaccinationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class FinalizeVaccinationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class VoidVaccinationDto extends FinalizeVaccinationDto {
  @IsString()
  @MaxLength(1000)
  @Matches(/\S/, { message: 'reason must contain a non-whitespace character' })
  reason!: string;
}

// List filters are bounded and use civil dates without timezone conversion.
export class VaccinationListQueryDto {
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
  @IsEnum(PreventiveRecordStatus)
  status?: PreventiveRecordStatus;

  @IsOptional()
  @IsUUID()
  clinicalEncounterId?: string;

  @IsOptional()
  @Matches(CIVIL_DATE)
  from?: string;

  @IsOptional()
  @Matches(CIVIL_DATE)
  to?: string;
}
