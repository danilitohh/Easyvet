import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, OrganizationStatus, UserStatus } from '@prisma/client';
import type {
  PlatformOrganizationsQueryDto,
  UpdatePlatformOrganizationStatusDto,
} from './platform.dto';
import { PrismaService } from '../infrastructure/database/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [
      totalOrganizations,
      activeOrganizations,
      suspendedOrganizations,
      archivedOrganizations,
      totalUsers,
      activeUsers,
      activeMemberships,
      recentOrganizations,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: OrganizationStatus.ACTIVE } }),
      this.prisma.organization.count({ where: { status: OrganizationStatus.SUSPENDED } }),
      this.prisma.organization.count({ where: { status: OrganizationStatus.ARCHIVED } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.membership.count({ where: { status: MembershipStatus.ACTIVE } }),
      this.prisma.organization.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          _count: { select: { memberships: true } },
        },
      }),
    ]);

    return {
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
        suspended: suspendedOrganizations,
        archived: archivedOrganizations,
      },
      users: { total: totalUsers, active: activeUsers },
      memberships: { active: activeMemberships },
      recentOrganizations: recentOrganizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        createdAt: organization.createdAt.toISOString(),
        memberCount: organization._count.memberships,
      })),
    };
  }

  async organizations(query: PlatformOrganizationsQueryDto) {
    const search = query.search?.trim();
    const where = {
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { slug: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [total, organizations] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
        take: 100,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          _count: { select: { memberships: true } },
        },
      }),
    ]);

    return {
      total,
      data: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        createdAt: organization.createdAt.toISOString(),
        memberCount: organization._count.memberships,
      })),
    };
  }

  async organizationDetail(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        timezone: true,
        locale: true,
        currencyCode: true,
        _count: {
          select: {
            memberships: true,
            clinicLocations: true,
          },
        },
        clinicLocations: {
          orderBy: { name: 'asc' },
          take: 10,
          select: { id: true, name: true, status: true, city: true },
        },
      },
    });
    if (!organization) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });

    const [membershipGroups, recentEvents] = await Promise.all([
      this.prisma.membership.groupBy({
        by: ['status', 'role'],
        where: { organizationId },
        _count: { _all: true },
      }),
      this.prisma.platformAuditEvent.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          metadata: true,
          createdAt: true,
          actor: { select: { email: true } },
        },
      }),
    ]);

    const membershipCounts = { ACTIVE: 0, INVITED: 0, SUSPENDED: 0 };
    const roleCounts = new Map<string, number>();
    for (const group of membershipGroups) {
      membershipCounts[group.status] += group._count._all;
      roleCounts.set(group.role, (roleCounts.get(group.role) ?? 0) + group._count._all);
    }

    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
      memberCount: organization._count.memberships,
      timezone: organization.timezone,
      locale: organization.locale,
      currencyCode: organization.currencyCode,
      memberships: {
        total: organization._count.memberships,
        active: membershipCounts.ACTIVE,
        invited: membershipCounts.INVITED,
        suspended: membershipCounts.SUSPENDED,
        byRole: [...roleCounts.entries()]
          .sort(([first], [second]) => first.localeCompare(second))
          .map(([role, count]) => ({ role, count })),
      },
      locations: {
        total: organization._count.clinicLocations,
        data: organization.clinicLocations,
      },
      recentAdministrativeActivity: recentEvents.map((event) => {
        const metadata =
          event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
            ? event.metadata
            : {};
        return {
          id: event.id,
          actorEmail: event.actor.email,
          from: typeof metadata.from === 'string' ? metadata.from : null,
          to: typeof metadata.to === 'string' ? metadata.to : null,
          reason: typeof metadata.reason === 'string' ? metadata.reason : null,
          createdAt: event.createdAt.toISOString(),
        };
      }),
    };
  }

  async changeOrganizationStatus(
    organizationId: string,
    actorUserId: string,
    input: UpdatePlatformOrganizationStatusDto,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, status: true },
    });
    if (!organization) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });
    if (organization.status === OrganizationStatus.ARCHIVED) {
      throw new BadRequestException({
        code: 'ARCHIVED_ORGANIZATION_IMMUTABLE',
        message: 'Archived organizations cannot be reactivated from the platform console.',
      });
    }
    if (organization.status === input.status) return organization;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: organizationId },
        data: { status: input.status },
        select: { id: true, name: true, status: true },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorUserId,
          organizationId,
          action: 'ORGANIZATION_STATUS_CHANGED',
          metadata: {
            from: organization.status,
            to: input.status,
            reason: input.reason,
          },
        },
      });
      return updated;
    });
  }

  async activity() {
    const events = await this.prisma.platformAuditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        actor: { select: { email: true } },
        organization: { select: { name: true } },
      },
    });
    return {
      data: events.map((event) => ({
        id: event.id,
        action: event.action,
        organizationName: event.organization?.name ?? null,
        actorEmail: event.actor.email,
        metadata:
          event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
            ? event.metadata
            : null,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}
