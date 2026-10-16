import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashMovementType,
  CashSessionStatus,
  CommercialAuditAction,
  ClinicLocationStatus,
  Prisma,
} from '@prisma/client';
import type {
  CashMovement,
  CashMovementListResponse,
  CashSessionDetail,
  CashSessionListQuery,
  CashSessionListResponse,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { PrismaService } from '../infrastructure/database/prisma.service';
import type {
  CashMovementListQueryDto,
  CloseCashSessionDto,
  CreateCashMovementDto,
  OpenCashSessionDto,
} from './commercial.dto';
import {
  cashMovementSelect,
  cashSessionInclude,
  toCashMovement,
  toCashSession,
  toCashSessionDetail,
} from './commercial.mapper';

type Transaction = Prisma.TransactionClient;
const ZERO = new Prisma.Decimal(0);
const MONEY_MAX = new Prisma.Decimal('9999999999999999.9999');

// Tenant-scoped unknown IDs have the same public response as cross-tenant IDs.
function notFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

// Cash concurrency failures have stable public codes for frontend recovery.
function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function validation(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

// All cash arithmetic uses exact Decimal values and the ledger's four-place money scale.
function rounded(value: Prisma.Decimal): Prisma.Decimal {
  const result = value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  if (result.abs().gt(MONEY_MAX)) throw validation('Cash amount exceeds supported precision');
  return result;
}

// CashSessionsService serializes every mutation through the session row before reading its ledger.
@Injectable()
export class CashSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Lists tenant sessions and computes each live balance from the append-only cash ledger.
  async list(
    organizationId: string,
    query: CashSessionListQuery,
  ): Promise<CashSessionListResponse> {
    this.assertDateRange(query.from, query.to);
    const where: Prisma.CashSessionWhereInput = {
      organizationId,
      ...(query.clinicLocationId ? { clinicLocationId: query.clinicLocationId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            openedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [sessions, total] = await Promise.all([
      this.prisma.cashSession.findMany({
        where,
        include: cashSessionInclude,
        orderBy: [{ openedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.cashSession.count({ where }),
    ]);
    const totals = await this.ledgerTotals(
      organizationId,
      sessions.map((session) => session.id),
    );
    return this.page(
      sessions.map((session) => toCashSession(session, totals.get(session.id) ?? ZERO)),
      query.page,
      query.pageSize,
      total,
    );
  }

  // Returns the current active drawer for a location without allowing client-selected tenant scope.
  async current(organizationId: string, clinicLocationId: string) {
    const session = await this.prisma.cashSession.findFirst({
      where: { organizationId, clinicLocationId, status: CashSessionStatus.OPEN },
      include: cashSessionInclude,
    });
    if (!session) return null;
    const totals = await this.ledgerTotals(organizationId, [session.id]);
    return toCashSession(session, totals.get(session.id) ?? ZERO);
  }

  // Details return only the current/final balance summary; ledger history is paginated separately.
  async findOne(organizationId: string, sessionId: string): Promise<CashSessionDetail> {
    const session = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, organizationId },
      include: cashSessionInclude,
    });
    if (!session) throw notFound();
    const totals = await this.ledgerTotals(organizationId, [sessionId]);
    return toCashSessionDetail(session, totals.get(sessionId) ?? ZERO);
  }

  // Ledger history is separately paginated for cash desks with many movements.
  async listMovements(
    organizationId: string,
    sessionId: string,
    query: CashMovementListQueryDto,
  ): Promise<CashMovementListResponse> {
    await this.requireSession(organizationId, sessionId);
    const where = { organizationId, cashSessionId: sessionId };
    const [records, total] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where,
        select: cashMovementSelect,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.cashMovement.count({ where }),
    ]);
    return this.page(records.map(toCashMovement), query.page, query.pageSize, total);
  }

  // Opening locks the location and relies on a PostgreSQL partial unique index for one OPEN drawer.
  async open(tenant: TenantContext, input: OpenCashSessionDto) {
    try {
      const sessionId = await this.prisma.$transaction(async (tx) => {
        const locations = await tx.$queryRaw<Array<{ id: string; status: ClinicLocationStatus }>>`
          SELECT id, status FROM clinic_locations
          WHERE id = ${input.clinicLocationId}::uuid
            AND organization_id = ${tenant.organizationId}::uuid
          FOR UPDATE
        `;
        if (!locations[0]) throw notFound();
        if (locations[0].status !== ClinicLocationStatus.ACTIVE) {
          throw conflict('LOCATION_INACTIVE', 'Cash sessions require an active location');
        }
        const commercialSettings = await tx.organizationCommercialSettings.findUnique({
          where: { organizationId: tenant.organizationId },
          select: { currencyCode: true },
        });
        const organization = commercialSettings
          ? null
          : await tx.organization.findUnique({
              where: { id: tenant.organizationId },
              select: { currencyCode: true },
            });
        const currencyCode = commercialSettings?.currencyCode ?? organization?.currencyCode;
        if (!currencyCode) throw notFound();
        const session = await tx.cashSession.create({
          data: {
            organizationId: tenant.organizationId,
            clinicLocationId: input.clinicLocationId,
            currencyCode,
            openingCashAmount: new Prisma.Decimal(input.openingCashAmount),
            openedByMembershipId: tenant.membershipId,
            notes: input.notes?.trim() || null,
          },
          select: { id: true },
        });
        await tx.commercialAuditEvent.create({
          data: {
            organizationId: tenant.organizationId,
            cashSessionId: session.id,
            actorMembershipId: tenant.membershipId,
            action: CommercialAuditAction.CASH_SESSION_OPENED,
          },
        });
        return session.id;
      });
      return this.findOne(tenant.organizationId, sessionId);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw conflict(
          'CASH_SESSION_ALREADY_OPEN',
          'A cash session is already open for this location',
        );
      }
      throw error;
    }
  }

  // Manual movement validates expected version and nonnegative drawer cash under the session lock.
  async createMovement(
    tenant: TenantContext,
    sessionId: string,
    input: CreateCashMovementDto,
  ): Promise<CashMovement> {
    const movementId = await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, tenant.organizationId, sessionId);
      this.assertOpenVersion(session, input.expectedVersion);
      const currentExpected = await this.expectedCash(
        tx,
        tenant.organizationId,
        sessionId,
        session.openingCashAmount,
      );
      const amount = new Prisma.Decimal(input.amount);
      const delta = input.type === CashMovementType.MANUAL_IN ? amount : amount.negated();
      const nextExpected = rounded(currentExpected.plus(delta));
      if (nextExpected.isNegative())
        throw conflict(
          'CASH_INSUFFICIENT_BALANCE',
          'Cash out cannot exceed the current drawer balance',
        );
      const movement = await tx.cashMovement.create({
        data: {
          organizationId: tenant.organizationId,
          cashSessionId: sessionId,
          movementType: input.type,
          amountDelta: delta,
          occurredAt: new Date(input.occurredAt),
          reason: input.reason.trim(),
          reference: input.reference?.trim() || null,
          createdByMembershipId: tenant.membershipId,
        },
        select: { id: true },
      });
      await tx.cashSession.update({
        where: { id_organizationId: { id: sessionId, organizationId: tenant.organizationId } },
        data: { version: { increment: 1 } },
      });
      await tx.commercialAuditEvent.create({
        data: {
          organizationId: tenant.organizationId,
          cashSessionId: sessionId,
          actorMembershipId: tenant.membershipId,
          action: CommercialAuditAction.CASH_MOVEMENT_CREATED,
          metadata: { movementType: input.type },
        },
      });
      return movement.id;
    });
    const movement = await this.prisma.cashMovement.findFirst({
      where: { id: movementId, organizationId: tenant.organizationId },
      select: cashMovementSelect,
    });
    if (!movement) throw notFound();
    return toCashMovement(movement);
  }

  // Close locks the drawer, computes expected from ledger, and freezes count and variance exactly once.
  async close(
    tenant: TenantContext,
    sessionId: string,
    input: CloseCashSessionDto,
  ): Promise<CashSessionDetail> {
    await this.prisma.$transaction(async (tx) => {
      const session = await this.lockSession(tx, tenant.organizationId, sessionId);
      this.assertOpenVersion(session, input.expectedVersion);
      const expected = await this.expectedCash(
        tx,
        tenant.organizationId,
        sessionId,
        session.openingCashAmount,
      );
      const counted = new Prisma.Decimal(input.countedCashAmount);
      const difference = rounded(counted.minus(expected));
      const closedAt = new Date();
      await tx.cashSession.update({
        where: { id_organizationId: { id: sessionId, organizationId: tenant.organizationId } },
        data: {
          status: CashSessionStatus.CLOSED,
          version: { increment: 1 },
          closedAt,
          closedByMembershipId: tenant.membershipId,
          expectedCashAmount: expected,
          countedCashAmount: counted,
          differenceAmount: difference,
          notes: input.notes?.trim() || session.notes,
        },
      });
      await tx.commercialAuditEvent.create({
        data: {
          organizationId: tenant.organizationId,
          cashSessionId: sessionId,
          actorMembershipId: tenant.membershipId,
          action: CommercialAuditAction.CASH_SESSION_CLOSED,
          metadata: { version: input.expectedVersion + 1 },
        },
      });
    });
    return this.findOne(tenant.organizationId, sessionId);
  }

  // Explicit row locking serializes manual movements, Sale tenders, voids and close against one session.
  private async lockSession(tx: Transaction, organizationId: string, sessionId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM cash_sessions
      WHERE id = ${sessionId}::uuid AND organization_id = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (!rows[0]) throw notFound();
    const session = await tx.cashSession.findFirst({
      where: { id: sessionId, organizationId },
      include: cashSessionInclude,
    });
    if (!session) throw notFound();
    return session;
  }

  // Closed drawers reject stale writes and never reopen through generic update operations.
  private assertOpenVersion(
    session: { status: CashSessionStatus; version: number },
    expectedVersion: number,
  ): void {
    if (session.status !== CashSessionStatus.OPEN)
      throw conflict('CASH_SESSION_CLOSED', 'This cash session is closed');
    if (session.version !== expectedVersion)
      throw conflict('CASH_SESSION_STALE', 'Cash session changed; reload before retrying');
  }

  // Expected cash remains a query over ledger evidence and is called only while the drawer lock is held.
  private async expectedCash(
    tx: Transaction,
    organizationId: string,
    sessionId: string,
    openingAmount: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    const aggregate = await tx.cashMovement.aggregate({
      where: { organizationId, cashSessionId: sessionId },
      _sum: { amountDelta: true },
    });
    return rounded(openingAmount.plus(aggregate._sum.amountDelta ?? ZERO));
  }

  // Grouping only the requested page keeps session lists bounded even with a large historical ledger.
  private async ledgerTotals(
    organizationId: string,
    sessionIds: string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (sessionIds.length === 0) return new Map();
    const groups = await this.prisma.cashMovement.groupBy({
      by: ['cashSessionId'],
      where: { organizationId, cashSessionId: { in: sessionIds } },
      _sum: { amountDelta: true },
    });
    return new Map(groups.map((group) => [group.cashSessionId, group._sum.amountDelta ?? ZERO]));
  }

  // Session existence is checked before exposing a movement history route.
  private async requireSession(organizationId: string, sessionId: string): Promise<void> {
    const exists = await this.prisma.cashSession.findFirst({
      where: { id: sessionId, organizationId },
      select: { id: true },
    });
    if (!exists) throw notFound();
  }

  // A database unique violation can race with another process opening the same location.
  private isUniqueViolation(error: unknown): boolean {
    return (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === '23505')
    );
  }

  // Date filters are validated before reaching PostgreSQL so inverted ranges do not look like valid emptiness.
  private assertDateRange(from?: string, to?: string): void {
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      throw validation('from must be earlier than or equal to to');
    }
  }

  // The response page helper keeps pagination shape aligned with shared contracts.
  private page<T>(data: T[], page: number, pageSize: number, total: number) {
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }
}
