import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
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
import { DiagnosticCategory, DiagnosticOrderStatus } from '@prisma/client';

const OFFSET_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Draft payloads contain only editable study fields; tenant and lifecycle data are server-owned.
class DiagnosticOrderDraftFieldsDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(300)
  testName?: string | null;

  @IsOptional()
  @Matches(OFFSET_DATE_TIME)
  @IsDateString({ strict: true })
  requestedAt?: string | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(5000)
  reason?: string | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(10000)
  instructions?: string | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(10000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  responsiblePractitionerMembershipId?: string | null;
}

export class CreateDiagnosticOrderDto extends DiagnosticOrderDraftFieldsDto {
  @IsEnum(DiagnosticCategory)
  category!: DiagnosticCategory;
}

// Every draft update carries the version seen by the editor and uses a compare-and-swap write.
export class UpdateDiagnosticOrderDto extends DiagnosticOrderDraftFieldsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;

  @IsOptional()
  @IsEnum(DiagnosticCategory)
  category?: DiagnosticCategory;
}

export class DiagnosticOrderVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedVersion!: number;
}

export class ResultDiagnosticOrderDto extends DiagnosticOrderVersionDto {
  @Matches(OFFSET_DATE_TIME)
  @IsDateString({ strict: true })
  resultedAt!: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(20000)
  resultText?: string | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(10000)
  interpretation?: string | null;
}

export class VoidDiagnosticOrderDto extends DiagnosticOrderVersionDto {
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

// List filters are bounded and ordered by the requested clinical date, with Drafts retained.
export class DiagnosticOrderListQueryDto {
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
  @IsEnum(DiagnosticOrderStatus)
  status?: DiagnosticOrderStatus;

  @IsOptional()
  @IsEnum(DiagnosticCategory)
  category?: DiagnosticCategory;

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
