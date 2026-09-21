import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OwnerStatus, PatientStatus, Prisma } from '@prisma/client';
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
type DomainDatabase = PrismaService | Prisma.TransactionClient;

function trimNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeIdentifier(value: string | null | undefined): string | null {
  const normalized = trimNullable(value);
  return normalized ? normalized.replace(/\s+/g, ' ').toUpperCase() : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = trimNullable(value);
  return normalized ? normalized.toLowerCase() : null;
}

function archivedResource(): ConflictException {
  return new ConflictException({
    code: 'RESOURCE_ARCHIVED',
    message: 'Archived resources cannot be edited until a restore policy exists',
  });
}

function activePatientsPreventArchive(): ConflictException {
  return new ConflictException({
    code: 'OWNER_HAS_ACTIVE_PATIENTS',
    message: 'Owner cannot be archived while active patients are linked',
  });
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
    try {
      await this.prisma.$transaction(async (tx) => {
        // Owner edits share the row lock used by prescription finalization snapshots.
        await this.lockOwner(tx, organizationId, ownerId);
        const current = await tx.owner.findFirst({
          where: { id: ownerId, organizationId },
          select: ownerListSelect,
        });
        if (!current) throw resourceNotFound();
        if (current.status === OwnerStatus.ARCHIVED) throw archivedResource();

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

        await tx.owner.update({
          where: { id_organizationId: { id: ownerId, organizationId } },
          data,
          select: { id: true },
        });
      });
      return this.findRequired(organizationId, ownerId);
    } catch (error) {
      this.rethrowConflict(error);
      throw error;
    }
  }

  async archiveForOrganization(organizationId: string, ownerId: string) {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockOwner(tx, organizationId, ownerId);
      if (!current) throw resourceNotFound();
      if (current.status === OwnerStatus.ARCHIVED) return;

      const activePatients = await tx.patient.count({
        where: { organizationId, ownerId, status: PatientStatus.ACTIVE },
      });
      if (activePatients > 0) throw activePatientsPreventArchive();

      await tx.owner.update({
        where: { id_organizationId: { id: ownerId, organizationId } },
        data: { status: OwnerStatus.ARCHIVED, archivedAt: new Date() },
        select: { id: true },
      });
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

  // Owner row locking serializes archive decisions with Patient creation for one tenant.
  private async lockOwner(
    database: DomainDatabase,
    organizationId: string,
    ownerId: string,
  ): Promise<{ id: string; status: OwnerStatus } | null> {
    const rows = await database.$queryRaw<Array<{ id: string; status: OwnerStatus }>>(
      Prisma.sql`
        SELECT "id", "status"
        FROM "owners"
        WHERE "id" = ${ownerId}::uuid AND "organization_id" = ${organizationId}::uuid
        FOR UPDATE
      `,
    );
    return rows[0] ?? null;
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
