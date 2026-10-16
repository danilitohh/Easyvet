import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

const zonedTimestamp = { strict: true } as const;

// Appointment writes intentionally omit tenant, lifecycle and audit fields.
export class CreateAppointmentDto {
  @IsUUID()
  clinicLocationId!: string;

  @IsUUID()
  patientId!: string;

  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsUUID()
  assignedMembershipId?: string | null;

  @IsISO8601(zonedTimestamp)
  startsAt!: string;

  @IsISO8601(zonedTimestamp)
  endsAt!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  assignedMembershipId?: string | null;
}

export class RescheduleAppointmentDto {
  @IsISO8601(zonedTimestamp)
  startsAt!: string;

  @IsISO8601(zonedTimestamp)
  endsAt!: string;
}

export class CancelAppointmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string | null;
}

export class AppointmentListQueryDto {
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
  pageSize = 100;

  @IsISO8601(zonedTimestamp)
  from!: string;

  @IsISO8601(zonedTimestamp)
  to!: string;

  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsUUID()
  assignedMembershipId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}

export class AvailabilityRuleDto {
  @IsUUID()
  clinicLocationId!: string;

  @IsOptional()
  @IsUUID()
  membershipId?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startLocalTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endLocalTime!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  slotMinutes = 30;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class AvailabilityRuleListQueryDto {
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
}

export class UpdateAvailabilityRuleDto {
  @IsOptional()
  @IsUUID()
  clinicLocationId?: string;

  @IsOptional()
  @IsUUID()
  membershipId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startLocalTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endLocalTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  slotMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AvailableSlotsQueryDto {
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsUUID()
  clinicLocationId!: string;

  @IsOptional()
  @IsUUID()
  assignedMembershipId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes!: number;
}
