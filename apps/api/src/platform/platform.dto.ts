import { OrganizationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PlatformOrganizationsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(['ALL', ...Object.values(OrganizationStatus)])
  status: 'ALL' | OrganizationStatus = 'ALL';
}

export class UpdatePlatformOrganizationStatusDto {
  @IsIn([OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED])
  status!: OrganizationStatus;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
