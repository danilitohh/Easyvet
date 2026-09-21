import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PreventiveRecordStatus } from '@prisma/client';

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Deworming fields remain optional in a draft and become required only at finalization.
export class CreateDewormingDto {
  @IsOptional()
  @Matches(CIVIL_DATE)
  administeredOn?: string | null;

  @IsOptional()
  @Matches(CIVIL_DATE)
  nextDueOn?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  dewormingType?: string | null;

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
export class UpdateDewormingDto extends CreateDewormingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class FinalizeDewormingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class VoidDewormingDto extends FinalizeDewormingDto {
  @IsString()
  @MaxLength(1000)
  @Matches(/\S/, { message: 'reason must contain a non-whitespace character' })
  reason!: string;
}

// List filters are bounded and use civil dates without timezone conversion.
export class DewormingListQueryDto {
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
