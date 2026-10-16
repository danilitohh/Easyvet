import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  CashSessionStatus,
  ClinicLocationStatus,
  GroomingVisitStatus,
  OrganizationAuditAction,
  Prisma,
} from '@prisma/client';
import type { LocationListQuery, LocationListResponse } from '@veterinary-saas/contracts';
import { PrismaService } from '../infrastructure/database/prisma.service';

export type CreateLocationInput = {
  name: string;
  address?: string | null;
  city?: string | null;
};

export type UpdateLocationInput = Partial<CreateLocationInput>;

function notFound(): NotFoundException {
  return new NotFoundException({ code: 'LOCATION_NOT_FOUND', message: 'Location not found' });
}

// Clinic locations remain tenant children; state changes are serialized against guarded operations.
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(organizationId: string, actorMembershipId: string, input: CreateLocationInput) {
    return this.prisma.$transaction(async (tx) => {
      const location = await tx.clinicLocation.create({
        data: {
          organizationId,
          name: input.name.trim(),
          address: this.cleanOptional(input.address),
          city: this.cleanOptional(input.city),
        },
      });
      await this.writeAudit(tx, {
        organizationId,
        actorMembershipId,
        entityType: 'CLINIC_LOCATION',
        entityId: location.id,
        action: OrganizationAuditAction.CLINIC_LOCATION_CREATED,
        metadata: { fields: ['name', 'address', 'city'] },
      });
      return location;
    });
  }

  async findForOrganization(
    organizationId: string,
    query: LocationListQuery,
  ): Promise<LocationListResponse> {
    const where = { organizationId };
    const [locations, total] = await this.prisma.$transaction([
      this.prisma.clinicLocation.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.clinicLocation.count({ where }),
    ]);
    return {
      data: locations.map((location) => ({
        id: location.id,
        name: location.name,
        status: location.status,
        address: location.address,
        city: location.city,
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
      },
    };
  }

  // Filters by both resource id and tenant id so cross-tenant ids resolve as not found.
  findByIdForOrganization(organizationId: string, locationId: string) {
    return this.prisma.clinicLocation.findFirst({ where: { id: locationId, organizationId } });
  }

  async update(
    organizationId: string,
    locationId: string,
    actorMembershipId: string,
    input: UpdateLocationInput,
  ) {
    const data = {
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.address === undefined ? {} : { address: this.cleanOptional(input.address) }),
      ...(input.city === undefined ? {} : { city: this.cleanOptional(input.city) }),
    };
    if (!Object.keys(data).length) return this.requireById(organizationId, locationId);
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.clinicLocation.findFirst({
        where: { id: locationId, organizationId },
      });
      if (!current) throw notFound();
      const updated = await tx.clinicLocation.update({ where: { id: current.id }, data });
      await this.writeAudit(tx, {
        organizationId,
        actorMembershipId,
        entityType: 'CLINIC_LOCATION',
        entityId: current.id,
        action: OrganizationAuditAction.CLINIC_LOCATION_UPDATED,
        metadata: { fields: Object.keys(data) },
      });
      return updated;
    });
  }

  // Locking the location makes blocker checks race-safe against operations using the same shared lock.
  async deactivate(organizationId: string, locationId: string, actorMembershipId: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: ClinicLocationStatus }>>`
        SELECT id, status FROM clinic_locations
        WHERE id = ${locationId}::uuid AND organization_id = ${organizationId}::uuid
        FOR UPDATE
      `;
      const location = rows[0];
      if (!location) throw notFound();
      if (location.status !== ClinicLocationStatus.ACTIVE) {
        return tx.clinicLocation.findUniqueOrThrow({ where: { id: location.id } });
      }

      const now = new Date();
      const [openCash, activeGrooming, futureAppointments] = await Promise.all([
        tx.cashSession.findFirst({
          where: { organizationId, clinicLocationId: location.id, status: CashSessionStatus.OPEN },
          select: { id: true },
        }),
        tx.groomingVisit.findFirst({
          where: {
            organizationId,
            clinicLocationId: location.id,
            status: GroomingVisitStatus.IN_PROGRESS,
          },
          select: { id: true },
        }),
        tx.appointment.findFirst({
          where: {
            organizationId,
            clinicLocationId: location.id,
            OR: [
              {
                startsAt: { gte: now },
                status: { in: [AppointmentStatus.SCHEDULED, AppointmentStatus.WAITING_ROOM] },
              },
              { status: AppointmentStatus.IN_PROGRESS },
            ],
          },
          select: { id: true },
        }),
      ]);
      if (openCash) {
        throw new ConflictException({
          code: 'LOCATION_HAS_OPEN_CASH_SESSION',
          message: 'Close the cash session before deactivating this location',
        });
      }
      if (activeGrooming) {
        throw new ConflictException({
          code: 'LOCATION_HAS_ACTIVE_GROOMING',
          message: 'Complete the grooming visit before deactivating this location',
        });
      }
      if (futureAppointments) {
        throw new ConflictException({
          code: 'LOCATION_HAS_FUTURE_APPOINTMENTS',
          message: 'Move or cancel future appointments before deactivating this location',
        });
      }

      const updated = await tx.clinicLocation.update({
        where: { id: location.id },
        data: { status: ClinicLocationStatus.SUSPENDED },
      });
      await this.writeAudit(tx, {
        organizationId,
        actorMembershipId,
        entityType: 'CLINIC_LOCATION',
        entityId: location.id,
        action: OrganizationAuditAction.CLINIC_LOCATION_DEACTIVATED,
        metadata: { status: ClinicLocationStatus.SUSPENDED },
      });
      return updated;
    });
  }

  async activate(organizationId: string, locationId: string, actorMembershipId: string) {
    return this.prisma.$transaction(async (tx) => {
      const location = await tx.clinicLocation.findFirst({
        where: { id: locationId, organizationId },
      });
      if (!location) throw notFound();
      const updated = await tx.clinicLocation.update({
        where: { id: location.id },
        data: { status: ClinicLocationStatus.ACTIVE },
      });
      await this.writeAudit(tx, {
        organizationId,
        actorMembershipId,
        entityType: 'CLINIC_LOCATION',
        entityId: location.id,
        action: OrganizationAuditAction.CLINIC_LOCATION_UPDATED,
        metadata: { status: ClinicLocationStatus.ACTIVE },
      });
      return updated;
    });
  }

  private async requireById(organizationId: string, locationId: string) {
    const location = await this.findByIdForOrganization(organizationId, locationId);
    if (!location) throw notFound();
    return location;
  }

  private cleanOptional(value: string | null | undefined) {
    if (value === undefined || value === null) return null;
    return value.trim() || null;
  }

  private writeAudit(
    tx: Prisma.TransactionClient,
    event: {
      organizationId: string;
      actorMembershipId: string;
      entityType: string;
      entityId: string;
      action: OrganizationAuditAction;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return tx.organizationAuditEvent.create({ data: event });
  }
}
