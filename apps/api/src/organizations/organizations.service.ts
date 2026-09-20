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

  private normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }
}
