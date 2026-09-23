import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrganizationStatus, Prisma } from '@prisma/client';
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
  currencyCode?: string;
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
  async updateCurrent(organizationId: string, input: UpdateOrganizationInput) {
    const organization = await this.findCurrent(organizationId);
    if (!organization) return null;
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.OrganizationUpdateInput = {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone.trim() }),
        ...(input.locale === undefined ? {} : { locale: input.locale.trim() }),
        ...(input.currencyCode === undefined
          ? {}
          : { currencyCode: this.normalizeCurrencyCode(input.currencyCode) }),
      };
      const updated = await tx.organization.update({ where: { id: organization.id }, data });
      await tx.organizationCommercialSettings.upsert({
        where: { organizationId },
        update:
          input.currencyCode === undefined
            ? {}
            : { currencyCode: this.normalizeCurrencyCode(input.currencyCode) },
        create: {
          organizationId,
          currencyCode: this.normalizeCurrencyCode(updated.currencyCode),
          invoicePrefix: this.config.get('DEFAULT_INVOICE_PREFIX', { infer: true }),
        },
      });
      return updated;
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
}
