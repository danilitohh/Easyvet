import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OwnerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { CreateOwnerDto, OwnersQueryDto, UpdateOwnerDto } from './owner.dto';

const ownerListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  documentType: true,
  documentNumber: true,
  email: true,
  phone: true,
  secondaryPhone: true,
  address: true,
  city: true,
  notes: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OwnerSelect;

const ownerDetailSelect = {
  ...ownerListSelect,
  patients: {
    where: { status: 'ACTIVE' as const },
    select: { id: true, name: true, species: true, status: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.OwnerSelect;

type OwnerDetailRecord = Prisma.OwnerGetPayload<{ select: typeof ownerDetailSelect }>;

function trimNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeIdentifier(value: string | null | undefined): string | null {
  const normalized = trimNullable(value);
  return normalized ? normalized.toLocaleUpperCase() : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = trimNullable(value);
  return normalized ? normalized.toLocaleLowerCase() : null;
}

function resourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

function resourceConflict(): ConflictException {
  return new ConflictException({
    code: 'RESOURCE_CONFLICT',
    message: 'Owner document already exists',
  });
}

function validationError(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

// Owns explicit tenant-scoped Owner queries and archive transitions.
@Injectable()
export class OwnersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string, query: OwnersQueryDto) {
    const where = this.buildWhere(organizationId, query);
    const [items, total] = await Promise.all([
      this.prisma.owner.findMany({
        where,
        select: ownerListSelect,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.owner.count({ where }),
    ]);
    return { items, total };
  }

  findByIdForOrganization(
    organizationId: string,
    ownerId: string,
  ): Promise<OwnerDetailRecord | null> {
    return this.prisma.owner.findFirst({
      where: { id: ownerId, organizationId },
      select: ownerDetailSelect,
    });
  }

  async createForOrganization(organizationId: string, input: CreateOwnerDto) {
    const document = this.resolveDocument(input.documentType, input.documentNumber);
    try {
      const owner = await this.prisma.owner.create({
        data: {
          organizationId,
          firstName: this.requireText(input.firstName, 'firstName'),
          lastName: trimNullable(input.lastName) ?? null,
          documentType: document.documentType,
          documentNumber: document.documentNumber,
          documentNumberNormalized: document.documentNumberNormalized,
          email: normalizeEmail(input.email) ?? null,
          phone: trimNullable(input.phone) ?? null,
          secondaryPhone: trimNullable(input.secondaryPhone) ?? null,
          address: trimNullable(input.address) ?? null,
          city: trimNullable(input.city) ?? null,
          notes: trimNullable(input.notes) ?? null,
        },
        select: { id: true },
      });
      return this.findRequired(organizationId, owner.id);
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
  }

  async updateForOrganization(organizationId: string, ownerId: string, input: UpdateOwnerDto) {
    const current = await this.prisma.owner.findFirst({
      where: { id: ownerId, organizationId },
      select: ownerListSelect,
    });
    if (!current) throw resourceNotFound();

    const data: Prisma.OwnerUpdateInput = {};
    if (input.firstName !== undefined)
      data.firstName = this.requireText(input.firstName, 'firstName');
    if (input.lastName !== undefined) data.lastName = trimNullable(input.lastName) ?? null;
    if (input.email !== undefined) data.email = normalizeEmail(input.email);
    if (input.phone !== undefined) data.phone = trimNullable(input.phone) ?? null;
    if (input.secondaryPhone !== undefined)
      data.secondaryPhone = trimNullable(input.secondaryPhone) ?? null;
    if (input.address !== undefined) data.address = trimNullable(input.address) ?? null;
    if (input.city !== undefined) data.city = trimNullable(input.city) ?? null;
    if (input.notes !== undefined) data.notes = trimNullable(input.notes) ?? null;
    if (input.documentType !== undefined || input.documentNumber !== undefined) {
      const document = this.resolveDocument(
        input.documentType === undefined ? current.documentType : input.documentType,
        input.documentNumber === undefined ? current.documentNumber : input.documentNumber,
      );
      data.documentType = document.documentType;
      data.documentNumber = document.documentNumber;
      data.documentNumberNormalized = document.documentNumberNormalized ?? null;
    }

    try {
      await this.prisma.owner.update({ where: { id: ownerId }, data, select: { id: true } });
      return this.findRequired(organizationId, ownerId);
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
  }

  async archiveForOrganization(organizationId: string, ownerId: string) {
    const current = await this.prisma.owner.findFirst({
      where: { id: ownerId, organizationId },
      select: { id: true, status: true },
    });
    if (!current) throw resourceNotFound();
    if (current.status === OwnerStatus.ARCHIVED) return this.findRequired(organizationId, ownerId);

    await this.prisma.owner.update({
      where: { id: ownerId },
      data: { status: OwnerStatus.ARCHIVED, archivedAt: new Date() },
      select: { id: true },
    });
    return this.findRequired(organizationId, ownerId);
  }

  private buildWhere(organizationId: string, query: OwnersQueryDto): Prisma.OwnerWhereInput {
    const search = query.search?.trim();
    return {
      organizationId,
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { documentNumber: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private async findRequired(organizationId: string, ownerId: string): Promise<OwnerDetailRecord> {
    const owner = await this.findByIdForOrganization(organizationId, ownerId);
    if (!owner) throw resourceNotFound();
    return owner;
  }

  private resolveDocument(
    documentType: string | null | undefined,
    documentNumber: string | null | undefined,
  ) {
    const type = normalizeIdentifier(documentType) ?? null;
    const number = trimNullable(documentNumber) ?? null;
    if ((type && !number) || (!type && number)) {
      throw validationError('documentType and documentNumber must be provided together');
    }
    return {
      documentType: type,
      documentNumber: number,
      documentNumberNormalized: type && number ? normalizeIdentifier(number) : null,
    };
  }

  private requireText(value: string, field: string): string {
    const result = value.trim();
    if (!result) throw validationError(`${field} is required`);
    return result;
  }

  private rethrowConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw resourceConflict();
    }
  }
}
