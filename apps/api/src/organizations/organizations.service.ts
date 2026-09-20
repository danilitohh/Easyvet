import { Injectable } from '@nestjs/common';
import { OrganizationStatus, Prisma } from '@prisma/client';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateOrganizationInput) {
    const data: Prisma.OrganizationCreateInput = {
      name: input.name.trim(),
      slug: this.normalizeSlug(input.slug),
      status: input.status ?? OrganizationStatus.ACTIVE,
      timezone: input.timezone ?? 'UTC',
      locale: input.locale ?? 'es-CO',
      currencyCode: input.currencyCode ?? 'COP',
    };

    return this.prisma.organization.create({ data });
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
    return this.prisma.organization.update({
      where: { id: organization.id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.timezone === undefined ? {} : { timezone: input.timezone.trim() }),
        ...(input.locale === undefined ? {} : { locale: input.locale.trim() }),
        ...(input.currencyCode === undefined
          ? {}
          : { currencyCode: input.currencyCode.trim().toUpperCase() }),
      },
    });
  }

  private normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }
}
