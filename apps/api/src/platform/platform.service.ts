import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  MembershipStatus,
  OrganizationStatus,
  SubscriptionInterval,
  SubscriptionStatus,
  UserStatus,
} from '@prisma/client';
import type {
  AssignPlatformSubscriptionDto,
  PlatformOrganizationsQueryDto,
  PlatformSubscriptionsQueryDto,
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

  async subscriptionPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        eyebrow: true,
        description: true,
        currencyCode: true,
        monthlyPrice: true,
        annualPrice: true,
        annualDiscountPercent: true,
        features: true,
      },
    });
    return {
      data: plans.map((plan) => ({
        ...plan,
        monthlyPrice: plan.monthlyPrice?.toFixed(2) ?? null,
        annualPrice: plan.annualPrice?.toFixed(2) ?? null,
        annualDiscountPercent: plan.annualDiscountPercent?.toFixed(2) ?? null,
      })),
    };
  }

  async subscriptions(query: PlatformSubscriptionsQueryDto) {
    const search = query.search?.trim();
    const organizations = await this.prisma.organization.findMany({
      ...(search
        ? {
            where: {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { slug: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
      take: 100,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        subscription: {
          select: {
            id: true,
            status: true,
            interval: true,
            startsAt: true,
            trialEndsAt: true,
            endsAt: true,
            plan: { select: { code: true, name: true } },
          },
        },
      },
    });
    return {
      data: organizations.map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        organizationStatus: organization.status,
        subscription: organization.subscription
          ? {
              id: organization.subscription.id,
              planCode: organization.subscription.plan.code,
              planName: organization.subscription.plan.name,
              status: organization.subscription.status,
              interval: organization.subscription.interval,
              startsAt: organization.subscription.startsAt.toISOString(),
              trialEndsAt: organization.subscription.trialEndsAt?.toISOString() ?? null,
              endsAt: organization.subscription.endsAt?.toISOString() ?? null,
            }
          : null,
      })),
      total: organizations.length,
      limit: 100,
    };
  }

  async assignSubscription(
    organizationId: string,
    actorUserId: string,
    input: AssignPlatformSubscriptionDto,
  ) {
    const [organization, plan] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      }),
      this.prisma.subscriptionPlan.findUnique({
        where: { code: input.planCode },
        select: { id: true, code: true, name: true },
      }),
    ]);
    if (!organization) throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND' });
    if (!plan) throw new NotFoundException({ code: 'SUBSCRIPTION_PLAN_NOT_FOUND' });

    const isFree = plan.code === 'ESSENTIAL';
    if (
      isFree &&
      (input.status !== SubscriptionStatus.ACTIVE || input.interval !== SubscriptionInterval.NONE)
    ) {
      throw new BadRequestException({
        code: 'INVALID_FREE_PLAN_SUBSCRIPTION',
        message: 'The Esencial plan is active and does not use a billing interval.',
      });
    }
    if (!isFree && input.interval === SubscriptionInterval.NONE) {
      throw new BadRequestException({
        code: 'BILLING_INTERVAL_REQUIRED',
        message: 'Paid plans require a monthly or annual interval.',
      });
    }
    if (input.status === SubscriptionStatus.TRIAL && !input.trialEndsAt) {
      throw new BadRequestException({
        code: 'TRIAL_END_REQUIRED',
        message: 'A trial end date is required for trial subscriptions.',
      });
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const trialEndsAt = input.trialEndsAt ? new Date(input.trialEndsAt) : null;
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (
      (trialEndsAt && trialEndsAt < startsAt) ||
      (endsAt && endsAt < startsAt) ||
      (input.status === SubscriptionStatus.TRIAL && trialEndsAt && endsAt && endsAt < trialEndsAt)
    ) {
      throw new BadRequestException({
        code: 'INVALID_SUBSCRIPTION_DATES',
        message: 'Subscription dates must be in chronological order.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.organizationSubscription.findUnique({
        where: { organizationId },
        select: {
          status: true,
          interval: true,
          startsAt: true,
          trialEndsAt: true,
          endsAt: true,
          plan: { select: { code: true, name: true } },
        },
      });
      const updated = await tx.organizationSubscription.upsert({
        where: { organizationId },
        create: {
          organizationId,
          planId: plan.id,
          status: input.status,
          interval: input.interval,
          startsAt,
          trialEndsAt,
          endsAt,
        },
        update: {
          planId: plan.id,
          status: input.status,
          interval: input.interval,
          startsAt,
          trialEndsAt,
          endsAt,
        },
        select: {
          id: true,
          status: true,
          interval: true,
          startsAt: true,
          trialEndsAt: true,
          endsAt: true,
          plan: { select: { code: true, name: true } },
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorUserId,
          organizationId,
          action: 'ORGANIZATION_SUBSCRIPTION_CHANGED',
          metadata: {
            from: previous
              ? {
                  planCode: previous.plan.code,
                  status: previous.status,
                  interval: previous.interval,
                }
              : null,
            to: {
              planCode: plan.code,
              status: updated.status,
              interval: updated.interval,
              startsAt: updated.startsAt.toISOString(),
              trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
              endsAt: updated.endsAt?.toISOString() ?? null,
            },
            reason: input.reason,
          },
        },
      });
      return {
        id: updated.id,
        organization: { id: organization.id, name: organization.name },
        plan: updated.plan,
        status: updated.status,
        interval: updated.interval,
        startsAt: updated.startsAt.toISOString(),
        trialEndsAt: updated.trialEndsAt?.toISOString() ?? null,
        endsAt: updated.endsAt?.toISOString() ?? null,
      };
    });
  }
}
