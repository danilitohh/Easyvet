import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

// Reports accept civil dates, never client-supplied UTC timestamps or tenant ids.
export class ReportRangeDto {
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID()
  clinicLocationId?: string;
}
