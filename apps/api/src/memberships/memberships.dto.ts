import { ClinicalRole, MembershipRole, MembershipStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// API inputs allow only the identity fields needed to grant one tenant membership.
export class CreateStaffDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsEnum(MembershipRole)
  membershipRole!: MembershipRole;

  @IsOptional()
  @IsEnum(ClinicalRole)
  clinicalRole?: ClinicalRole | null;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsEnum(MembershipRole)
  membershipRole?: MembershipRole;

  @IsOptional()
  @IsEnum(ClinicalRole)
  clinicalRole?: ClinicalRole | null;
}

export class ListStaffDto {
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
  pageSize = 25;

  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;

  @IsOptional()
  @IsEnum(MembershipRole)
  role?: MembershipRole;

  @IsOptional()
  @IsEnum(ClinicalRole)
  clinicalRole?: ClinicalRole;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(160)
  search?: string;
}
