import { Injectable } from '@nestjs/common';
import { ClinicLocationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';

export type CreateLocationInput = {
  organizationId: string;
  name: string;
  status?: ClinicLocationStatus;
  address?: string;
  city?: string;
};

// Provides location persistence without treating a branch as an independent tenant.
@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateLocationInput) {
    const data: Prisma.ClinicLocationCreateInput = {
      name: input.name.trim(),
      status: input.status ?? ClinicLocationStatus.ACTIVE,
      ...(input.address === undefined ? {} : { address: input.address }),
      ...(input.city === undefined ? {} : { city: input.city }),
      organization: { connect: { id: input.organizationId } },
    };

    return this.prisma.clinicLocation.create({ data });
  }

  findForOrganization(organizationId: string) {
    return this.prisma.clinicLocation.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
