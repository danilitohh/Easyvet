import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AppointmentListResponse,
  AppointmentResponse,
  AvailabilityRuleListResponse,
  AvailabilityRuleResponse,
  AvailableSlotsResponse,
} from '@veterinary-saas/contracts';
import { AppointmentStatus } from '@prisma/client';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import { PERMISSIONS } from '../authorization/permissions';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import {
  AppointmentListQueryDto,
  AvailabilityRuleDto,
  AvailabilityRuleListQueryDto,
  AvailableSlotsQueryDto,
  CancelAppointmentDto,
  CreateAppointmentDto,
  RescheduleAppointmentDto,
  UpdateAppointmentDto,
  UpdateAvailabilityRuleDto,
} from './appointment.dto';
import { AppointmentsService } from './appointments.service';

function toAppointmentResponse(
  appointment: Awaited<ReturnType<AppointmentsService['findById']>>,
): AppointmentResponse {
  return {
    ...appointment,
    startsAt: appointment.startsAt.toISOString(),
    endsAt: appointment.endsAt.toISOString(),
    ownerConfirmedAt: appointment.ownerConfirmedAt?.toISOString() ?? null,
    clinicConfirmedAt: appointment.clinicConfirmedAt?.toISOString() ?? null,
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
  };
}

function toAvailabilityResponse(
  rule:
    | Awaited<ReturnType<AppointmentsService['listAvailability']>>['data'][number]
    | Awaited<ReturnType<AppointmentsService['createAvailability']>>,
): AvailabilityRuleResponse {
  const membership =
    'membership' in rule && rule.membership?.organizationId === rule.organizationId
      ? {
          id: rule.membership.id,
          role: rule.membership.role,
          user: { email: rule.membership.user.email },
        }
      : null;
  return {
    ...rule,
    membership,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

// Agenda endpoints keep writes explicit so lifecycle invariants cannot be bypassed by generic PATCH.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('appointments')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.READ)
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AppointmentListQueryDto,
  ): Promise<AppointmentListResponse> {
    const result = await this.appointments.list(tenant.organizationId, query);
    return {
      data: result.data.map((appointment) => toAppointmentResponse(appointment as never)),
      pagination: result.pagination,
    };
  }

  @Get('appointments/:appointmentId')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.READ)
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointments.findById(tenant.organizationId, appointmentId),
    );
  }

  @Post('appointments')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.CREATE)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: CreateAppointmentDto,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.appointments.create(tenant, body));
  }

  @Patch('appointments/:appointmentId')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.UPDATE)
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
    @Body() body: UpdateAppointmentDto,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.appointments.update(tenant, appointmentId, body));
  }

  @Post('appointments/:appointmentId/reschedule')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.UPDATE)
  async reschedule(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
    @Body() body: RescheduleAppointmentDto,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.appointments.reschedule(tenant, appointmentId, body));
  }

  @Post('appointments/:appointmentId/cancel')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.CANCEL)
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
    @Body() body: CancelAppointmentDto,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(await this.appointments.cancel(tenant, appointmentId, body));
  }

  @Post('appointments/:appointmentId/check-in')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.CHECK_IN)
  async checkIn(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointments.transition(
        tenant.organizationId,
        appointmentId,
        AppointmentStatus.WAITING_ROOM,
      ),
    );
  }

  @Post('appointments/:appointmentId/start')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.START)
  async start(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointments.transition(
        tenant.organizationId,
        appointmentId,
        AppointmentStatus.IN_PROGRESS,
      ),
    );
  }

  @Post('appointments/:appointmentId/complete')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.COMPLETE)
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointments.transition(
        tenant.organizationId,
        appointmentId,
        AppointmentStatus.COMPLETED,
      ),
    );
  }

  @Post('appointments/:appointmentId/no-show')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.MARK_NO_SHOW)
  async noShow(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointments.transition(
        tenant.organizationId,
        appointmentId,
        AppointmentStatus.NO_SHOW,
      ),
    );
  }

  @Post('appointments/:appointmentId/confirm-by-clinic')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.UPDATE)
  async confirmByClinic(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointments.confirm(tenant.organizationId, appointmentId, 'clinic'),
    );
  }

  @Post('appointments/:appointmentId/confirm-by-owner')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.UPDATE)
  async confirmByOwner(
    @CurrentTenant() tenant: TenantContext,
    @Param('appointmentId', new ParseUUIDPipe()) appointmentId: string,
  ): Promise<AppointmentResponse> {
    return toAppointmentResponse(
      await this.appointments.confirm(tenant.organizationId, appointmentId, 'owner'),
    );
  }

  @Get('availability-rules')
  @RequirePermissions(PERMISSIONS.AVAILABILITY.READ)
  async listAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AvailabilityRuleListQueryDto,
  ): Promise<AvailabilityRuleListResponse> {
    const result = await this.appointments.listAvailability(tenant.organizationId, query);
    return {
      data: result.data.map(toAvailabilityResponse),
      pagination: result.pagination,
      activeCount: result.activeCount,
    };
  }

  @Get('availability-rules/:ruleId')
  @RequirePermissions(PERMISSIONS.AVAILABILITY.READ)
  async findAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
  ): Promise<AvailabilityRuleResponse> {
    return toAvailabilityResponse(
      await this.appointments.findAvailability(tenant.organizationId, ruleId),
    );
  }

  @Post('availability-rules')
  @RequirePermissions(PERMISSIONS.AVAILABILITY.MANAGE)
  async createAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: AvailabilityRuleDto,
  ): Promise<AvailabilityRuleResponse> {
    return toAvailabilityResponse(
      await this.appointments.createAvailability(tenant.organizationId, body),
    );
  }

  @Patch('availability-rules/:ruleId')
  @RequirePermissions(PERMISSIONS.AVAILABILITY.MANAGE)
  async updateAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
    @Body() body: UpdateAvailabilityRuleDto,
  ): Promise<AvailabilityRuleResponse> {
    return toAvailabilityResponse(
      await this.appointments.updateAvailability(tenant.organizationId, ruleId, body),
    );
  }

  @Delete('availability-rules/:ruleId')
  @RequirePermissions(PERMISSIONS.AVAILABILITY.MANAGE)
  async deactivateAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Param('ruleId', new ParseUUIDPipe()) ruleId: string,
  ): Promise<AvailabilityRuleResponse> {
    return toAvailabilityResponse(
      await this.appointments.deactivateAvailability(tenant.organizationId, ruleId),
    );
  }

  @Get('agenda/available-slots')
  @RequirePermissions(PERMISSIONS.APPOINTMENTS.READ)
  async availableSlots(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AvailableSlotsQueryDto,
  ): Promise<AvailableSlotsResponse> {
    return this.appointments.availableSlots(tenant.organizationId, query);
  }
}
