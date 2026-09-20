import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PatientSex, PatientStatus } from '@prisma/client';

// Patient writes keep the Owner relationship immutable after creation in this phase.
export class CreatePatientDto {
  @IsUUID()
  ownerId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  species!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string | null;

  @IsOptional()
  @IsEnum(PatientSex)
  sex?: PatientSex;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate must be a civil date in YYYY-MM-DD format',
  })
  birthDate?: string | null;

  @IsOptional()
  @IsBoolean()
  birthDateEstimated?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  microchipNumber?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.001)
  currentWeightKg?: number | null;

  @IsOptional()
  @IsBoolean()
  sterilized?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdatePatientDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  species?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string | null;

  @IsOptional()
  @IsEnum(PatientSex)
  sex?: PatientSex;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'birthDate must be a civil date in YYYY-MM-DD format',
  })
  birthDate?: string | null;

  @IsOptional()
  @IsBoolean()
  birthDateEstimated?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  microchipNumber?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0.001)
  currentWeightKg?: number | null;

  @IsOptional()
  @IsBoolean()
  sterilized?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class PatientsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED', 'ALL'])
  status: PatientStatus | 'ALL' = PatientStatus.ACTIVE;

  @IsOptional()
  @IsIn(['createdAt', 'name', 'species'])
  sortBy: 'createdAt' | 'name' | 'species' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'asc';
}
