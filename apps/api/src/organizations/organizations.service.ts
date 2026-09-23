import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrganizationAuditAction, OrganizationStatus, Prisma } from '@prisma/client';
import type { Environment } from '../config/env';
import { PrismaService } from '../infrastructure/database/prisma.service';

export type CreateOrganizationInput = {
  name: string;
  slug: string;
  status?: OrganizationStatus;
  timezone?: string;
  locale?: string;
  currencyCode?: string;
};

export type UpdateOrganizationInput = {
  name?: string;
  timezone?: string;
  locale?: string;
};

// Provides the explicit organization data-access boundary for future tenant-aware use cases.
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async create(input: CreateOrganizationInput) {
    const data: Prisma.OrganizationCreateInput = {
      name: input.name.trim(),
      slug: this.normalizeSlug(input.slug),
      status: input.status ?? OrganizationStatus.ACTIVE,
      timezone: input.timezone ?? 'UTC',
      locale: input.locale ?? 'es-CO',
      currencyCode: this.normalizeCurrencyCode(
        input.currencyCode ?? this.config.get('DEFAULT_CURRENCY_CODE', { infer: true }),
      ),
    };

    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data });
      await tx.organizationCommercialSettings.create({
        data: {
          organizationId: organization.id,
          currencyCode: organization.currencyCode,
          invoicePrefix: this.config.get('DEFAULT_INVOICE_PREFIX', { infer: true }),
        },
      });
      return organization;
    });
  }

  findBySlug(slug: string) {
    return this.prisma.organization.findUnique({ where: { slug: this.normalizeSlug(slug) } });
  }

  // Reads only the active tenant selected by the authenticated session.
  findCurrent(organizationId: string) {
    return this.prisma.organization.findFirst({
      where: { id: organizationId, status: OrganizationStatus.ACTIVE },
    });
  }

  // Updates only fields explicitly approved for the current tenant endpoint.
  async updateCurrent(
    organizationId: string,
    actorMembershipId: string,
    input: UpdateOrganizationInput,
  ) {
    const organization = await this.findCurrent(organizationId);
    if (!organization) return null;
    if (input.timezone !== undefined) this.assertTimezone(input.timezone);
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.OrganizationUpdateInput = {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone.trim() }),
        ...(input.locale === undefined ? {} : { locale: input.locale.trim() }),
      };
      const updated = await tx.organization.update({ where: { id: organization.id }, data });
      await tx.organizationAuditEvent.create({
        data: {
          organizationId,
          actorMembershipId,
          entityType: 'ORGANIZATION',
          entityId: organizationId,
          action: OrganizationAuditAction.ORGANIZATION_UPDATED,
          metadata: {
            fields: Object.keys(input).filter((field) =>
              ['name', 'timezone', 'locale'].includes(field),
            ),
          },
        },
      });
      return updated;
    });
  }

  // Commercial defaults are organization-scoped and never mutate historical sale/invoice snapshots.
  async findCommercialSettings(organizationId: string) {
    return this.prisma.organizationCommercialSettings.findUnique({ where: { organizationId } });
  }

  async updateCommercialSettings(
    organizationId: string,
    actorMembershipId: string,
    input: { currencyCode?: string; invoicePrefix?: string },
  ) {
    const currencyCode = input.currencyCode
      ? this.normalizeCurrencyCode(input.currencyCode)
      : undefined;
    const invoicePrefix = input.invoicePrefix?.trim().toUpperCase();
    if (invoicePrefix !== undefined && !/^[A-Z0-9-]{1,16}$/.test(invoicePrefix)) {
      throw new BadRequestException({
        code: 'INVALID_INVOICE_PREFIX',
        message: 'Invoice prefix may contain letters, numbers and hyphens only',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findFirst({
        where: { id: organizationId, status: OrganizationStatus.ACTIVE },
        select: { id: true, currencyCode: true },
      });
      if (!organization) return null;
      const current = await tx.organizationCommercialSettings.findUnique({
        where: { organizationId },
      });
      const nextCurrency = currencyCode ?? current?.currencyCode ?? organization.currencyCode;
      const settings = await tx.organizationCommercialSettings.upsert({
        where: { organizationId },
        create: {
          organizationId,
          currencyCode: nextCurrency,
          invoicePrefix:
            invoicePrefix ?? this.config.get('DEFAULT_INVOICE_PREFIX', { infer: true }),
        },
        update: {
          ...(currencyCode === undefined ? {} : { currencyCode }),
          ...(invoicePrefix === undefined ? {} : { invoicePrefix }),
        },
      });
      if (currencyCode !== undefined) {
        await tx.organization.update({ where: { id: organizationId }, data: { currencyCode } });
      }
      await tx.organizationAuditEvent.create({
        data: {
          organizationId,
          actorMembershipId,
          entityType: 'COMMERCIAL_SETTINGS',
          entityId: organizationId,
          action: OrganizationAuditAction.COMMERCIAL_SETTINGS_UPDATED,
          metadata: {
            ...(currencyCode === undefined ? {} : { currencyCode }),
            ...(invoicePrefix === undefined ? {} : { invoicePrefix }),
          },
        },
      });
      return settings;
    });
  }

  // Currency codes remain explicit ISO-style uppercase values before they enter either tenant record.
  private normalizeCurrencyCode(value: string): string {
    const currencyCode = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new BadRequestException({
        code: 'INVALID_CURRENCY_CODE',
        message: 'Currency code must contain three uppercase letters',
      });
    }
    return currencyCode;
  }

  private normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }

  private assertTimezone(value: string) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format(new Date(0));
    } catch {
      throw new BadRequestException({
        code: 'INVALID_TIMEZONE',
        message: 'Enter a valid IANA timezone such as America/Bogota',
      });
    }
  }
}
