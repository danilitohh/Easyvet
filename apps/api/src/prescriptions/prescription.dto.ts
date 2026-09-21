import { Type } from 'class-transformer';
import {
  IsArray,
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
import { PrescriptionStatus } from '@prisma/client';

// Item validation keeps medication text flexible while bounding payload size and ordering.
export class PrescriptionItemDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  position!: number;

  @IsString()
  @MaxLength(500)
  medicationName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  presentation?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  quantity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dosage?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  frequency?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  duration?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  observations?: string | null;
}

// Draft creation derives tenant, patient, encounter and creator from the route and session.
export class CreatePrescriptionDto {
  @IsOptional()
  @IsUUID()
  prescribedByMembershipId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items?: PrescriptionItemDto[];
}

// Draft updates replace the editable item set atomically under an optimistic version.
export class UpdatePrescriptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsUUID()
  prescribedByMembershipId?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items!: PrescriptionItemDto[];
}

export class PrescriptionVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class VoidPrescriptionDto extends PrescriptionVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  reason!: string;
}

// Patient list queries are bounded and can optionally filter by parent encounter/status.
export class PrescriptionListQueryDto {
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
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @IsOptional()
  @IsUUID()
  clinicalEncounterId?: string;
}
