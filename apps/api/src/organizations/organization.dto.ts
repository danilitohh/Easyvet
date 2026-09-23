import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

// Strict body fields prevent clients from selecting or mutating tenant identity fields.
export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  locale?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/)
  currencyCode?: string;
}
