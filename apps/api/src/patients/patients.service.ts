import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OwnerStatus, PatientSex, PatientStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { CreatePatientDto, PatientsQueryDto, UpdatePatientDto } from './patient.dto';

const ownerSummarySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  status: true,
} satisfies Prisma.OwnerSelect;

const patientSelect = {
  id: true,
  ownerId: true,
  name: true,
  species: true,
  breed: true,
  sex: true,
  birthDate: true,
  birthDateEstimated: true,
  color: true,
  microchipNumber: true,
  currentWeightKg: true,
  sterilized: true,
  notes: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: ownerSummarySelect },
} satisfies Prisma.PatientSelect;

type PatientRecord = Prisma.PatientGetPayload<{ select: typeof patientSelect }>;
type DomainDatabase = PrismaService | Prisma.TransactionClient;

function trimNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeMicrochip(value: string | null | undefined): string | null {
  const normalized = trimNullable(value);
  return normalized ? normalized.toUpperCase() : null;
}

function resourceNotFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

function dateOnly(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'birthDate must be a civil date in YYYY-MM-DD format',
    });
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'birthDate is invalid' });
  }
  if (value > new Date().toISOString().slice(0, 10)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'birthDate cannot be in the future',
    });
  }
  return parsed;
}

function archivedResource(): ConflictException {
  return new ConflictException({
    code: 'RESOURCE_ARCHIVED',
    message: 'Archived resources cannot be edited until a restore policy exists',
  });
}

function futureAppointmentsPreventArchive(): ConflictException {
  return new ConflictException({
    code: 'PATIENT_HAS_FUTURE_APPOINTMENTS',
    message: 'Patient cannot be archived while future appointments remain active',
  });
}

// Owns explicit tenant-scoped Patient queries and archive transitions.
@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForOrganization(organizationId: string, query: PatientsQueryDto) {
    const where = this.buildWhere(organizationId, query);
    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        select: patientSelect,
        orderBy: { [query.sortBy]: query.sortDirection },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.patient.count({ where }),
    ]);
    return { items, total };
  }

  findByIdForOrganization(
    organizationId: string,
    patientId: string,
  ): Promise<PatientRecord | null> {
    return this.prisma.patient.findFirst({
      where: { id: patientId, organizationId },
      select: patientSelect,
    });
  }

  async createForOrganization(organizationId: string, input: CreatePatientDto) {
    const name = this.requireText(input.name, 'name');
    const nameNormalized = normalizeName(name);
    const patient = await this.prisma.$transaction(async (tx) => {
      await this.requireActiveOwner(tx, organizationId, input.ownerId);
      return tx.patient.create({
        data: {
          organizationId,
          ownerId: input.ownerId,
          name,
          nameNormalized,
          species: this.requireText(input.species, 'species'),
          breed: trimNullable(input.breed) ?? null,
          sex: input.sex ?? PatientSex.UNKNOWN,
          birthDate: dateOnly(input.birthDate) ?? null,
          birthDateEstimated: input.birthDateEstimated ?? false,
          color: trimNullable(input.color) ?? null,
          microchipNumber: normalizeMicrochip(input.microchipNumber) ?? null,
          currentWeightKg: input.currentWeightKg ?? null,
          sterilized: input.sterilized ?? false,
          notes: trimNullable(input.notes) ?? null,
        },
        select: { id: true },
      });
    });
    return this.findRequired(organizationId, patient.id);
  }

  async updateForOrganization(organizationId: string, patientId: string, input: UpdatePatientDto) {
    const current = await this.findByIdForOrganization(organizationId, patientId);
    if (!current) throw resourceNotFound();
    if (current.status === PatientStatus.ARCHIVED) throw archivedResource();

    const data: Prisma.PatientUpdateInput = {};
    if (input.name !== undefined) {
      const name = this.requireText(input.name, 'name');
      data.name = name;
      data.nameNormalized = normalizeName(name);
    }
    if (input.species !== undefined) data.species = this.requireText(input.species, 'species');
    if (input.breed !== undefined) data.breed = trimNullable(input.breed) ?? null;
    if (input.sex !== undefined) data.sex = input.sex;
    if (input.birthDate !== undefined) data.birthDate = dateOnly(input.birthDate) ?? null;
    if (input.birthDateEstimated !== undefined) data.birthDateEstimated = input.birthDateEstimated;
    if (input.color !== undefined) data.color = trimNullable(input.color) ?? null;
    if (input.microchipNumber !== undefined)
      data.microchipNumber = normalizeMicrochip(input.microchipNumber);
    if (input.currentWeightKg !== undefined) data.currentWeightKg = input.currentWeightKg;
    if (input.sterilized !== undefined) data.sterilized = input.sterilized;
    if (input.notes !== undefined) data.notes = trimNullable(input.notes) ?? null;

    const updated = await this.prisma.patient.updateMany({
      where: { id: patientId, organizationId },
      data,
    });
    if (updated.count !== 1) throw resourceNotFound();
    return this.findRequired(organizationId, patientId);
  }

  async archiveForOrganization(organizationId: string, patientId: string) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.patient.findFirst({
        where: { id: patientId, organizationId },
        select: { id: true, status: true },
      });
      if (!current) throw resourceNotFound();
      if (current.status === PatientStatus.ARCHIVED) return;
      const futureAppointments = await tx.appointment.count({
        where: {
          organizationId,
          patientId,
          startsAt: { gt: new Date() },
          status: { in: ['SCHEDULED', 'WAITING_ROOM', 'IN_PROGRESS', 'COMPLETED'] },
        },
      });
      if (futureAppointments > 0) throw futureAppointmentsPreventArchive();
      const updated = await tx.patient.updateMany({
        where: { id: patientId, organizationId },
        data: { status: PatientStatus.ARCHIVED, archivedAt: new Date() },
      });
      if (updated.count !== 1) throw resourceNotFound();
    });
    return this.findRequired(organizationId, patientId);
  }

  private buildWhere(organizationId: string, query: PatientsQueryDto): Prisma.PatientWhereInput {
    const search = query.search?.trim();
    return {
      organizationId,
      ...(query.status === 'ALL' ? {} : { status: query.status }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { microchipNumber: { contains: search, mode: 'insensitive' } },
              { owner: { firstName: { contains: search, mode: 'insensitive' } } },
              { owner: { lastName: { contains: search, mode: 'insensitive' } } },
              { owner: { email: { contains: search, mode: 'insensitive' } } },
              { owner: { phone: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  private async requireActiveOwner(
    database: DomainDatabase,
    organizationId: string,
    ownerId: string,
  ): Promise<void> {
    const owner = await this.lockOwner(database, organizationId, ownerId);
    if (!owner || owner.status !== OwnerStatus.ACTIVE) throw resourceNotFound();
  }

  // Owner row locking serializes create-versus-archive lifecycle decisions for one tenant.
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

  private async findRequired(organizationId: string, patientId: string): Promise<PatientRecord> {
    const patient = await this.findByIdForOrganization(organizationId, patientId);
    if (!patient) throw resourceNotFound();
    return patient;
  }

  private requireText(value: string, field: string): string {
    const result = value.trim();
    if (!result)
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: `${field} is required` });
    return result;
  }
}
