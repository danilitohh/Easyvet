import {
  OrganizationStatus,
  SubscriptionInterval,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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

export class PlatformSubscriptionsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class CreatePlatformAdminAccountDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class UpdatePlatformAdminAccountStatusDto {
  @IsIn([UserStatus.ACTIVE, UserStatus.SUSPENDED])
  status!: 'ACTIVE' | 'SUSPENDED';

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class AssignPlatformSubscriptionDto {
  @IsIn(['ESSENTIAL', 'GROWTH', 'CLINIC_PRO'])
  planCode!: 'ESSENTIAL' | 'GROWTH' | 'CLINIC_PRO';

  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;

  @IsEnum(SubscriptionInterval)
  interval!: SubscriptionInterval;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}
