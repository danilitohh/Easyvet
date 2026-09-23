import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  AnesthesiaRecordStatus,
  AppointmentStatus,
  CashSessionStatus,
  ClinicalEncounterStatus,
  ClinicalProcedureStatus,
  ConsentStatus,
  DiagnosticOrderStatus,
  GroomingVisitStatus,
  HospitalizationStatus,
  InventoryItemStatus,
  InvoiceStatus,
  PreventiveRecordStatus,
  PrescriptionStatus,
  SalePaymentStatus,
  SaleStatus,
} from '@prisma/client';
import { DateTime } from 'luxon';
import { PrismaService } from '../infrastructure/database/prisma.service';
import type { ReportRangeDto } from './reports.dto';

type Range = {
  from: string;
  to: string;
  timezone: string;
  start: Date;
  endExclusive: Date;
  today: Date;
  todayText: string;
  locationId?: string;
};

// Uses organization civil dates to build exclusive UTC timestamp boundaries, including DST changes.
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async operational(organizationId: string, query: ReportRangeDto) {
    const range = await this.resolveRange(organizationId, query);
    const location = range.locationId ? { clinicLocationId: range.locationId } : {};
    const dateWhere = { gte: range.start, lt: range.endExclusive };
    const dueToday = this.civilDate(range.todayText);
    const [
      appointmentRows,
      openFollowUps,
      overdue,
      dueTodayCount,
      groomingRows,
      activeHospitalizations,
      admissions,
      discharges,
    ] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: { organizationId, startsAt: dateWhere, ...location },
        _count: { _all: true },
      }),
      this.prisma.clinicalFollowUp.count({
        where: {
          organizationId,
          status: 'OPEN',
          ...(range.locationId
            ? { sourceClinicalEncounter: { is: { clinicLocationId: range.locationId } } }
            : {}),
        },
      }),
      this.prisma.clinicalFollowUp.count({
        where: {
          organizationId,
          status: 'OPEN',
          dueOn: { lt: dueToday },
          ...(range.locationId
            ? { sourceClinicalEncounter: { is: { clinicLocationId: range.locationId } } }
            : {}),
        },
      }),
      this.prisma.clinicalFollowUp.count({
        where: {
          organizationId,
          status: 'OPEN',
          dueOn: dueToday,
          ...(range.locationId
            ? { sourceClinicalEncounter: { is: { clinicLocationId: range.locationId } } }
            : {}),
        },
      }),
      this.prisma.groomingVisit.groupBy({
        by: ['status'],
        where: { organizationId, createdAt: dateWhere, ...location },
        _count: { _all: true },
      }),
      this.prisma.hospitalization.count({
        where: {
          organizationId,
          status: HospitalizationStatus.ACTIVE,
          ...(range.locationId
            ? { clinicalEncounter: { is: { clinicLocationId: range.locationId } } }
            : {}),
        },
      }),
      this.prisma.hospitalization.count({
        where: {
          organizationId,
          status: { in: [HospitalizationStatus.ACTIVE, HospitalizationStatus.DISCHARGED] },
          admittedAt: dateWhere,
          ...(range.locationId
            ? { clinicalEncounter: { is: { clinicLocationId: range.locationId } } }
            : {}),
        },
      }),
      this.prisma.hospitalization.count({
        where: {
          organizationId,
          status: HospitalizationStatus.DISCHARGED,
          dischargedAt: dateWhere,
          ...(range.locationId
            ? { clinicalEncounter: { is: { clinicLocationId: range.locationId } } }
            : {}),
        },
      }),
    ]);
    const appointmentCounts = this.statusCounts(appointmentRows);
    const groomingCounts = this.statusCounts(groomingRows);
    return {
      range: this.publicRange(range),
      appointments: {
        total: Object.values(appointmentCounts).reduce((sum, count) => sum + count, 0),
        completed: appointmentCounts[AppointmentStatus.COMPLETED] ?? 0,
        cancelled: appointmentCounts[AppointmentStatus.CANCELLED] ?? 0,
        noShow: appointmentCounts[AppointmentStatus.NO_SHOW] ?? 0,
      },
      followUps: { open: openFollowUps, overdue, dueToday: dueTodayCount },
      grooming: {
        draft: groomingCounts[GroomingVisitStatus.DRAFT] ?? 0,
        inProgress: groomingCounts[GroomingVisitStatus.IN_PROGRESS] ?? 0,
        completed: groomingCounts[GroomingVisitStatus.COMPLETED] ?? 0,
      },
      hospitalization: { currentlyActive: activeHospitalizations, admissions, discharges },
    };
  }

  async clinical(organizationId: string, query: ReportRangeDto) {
    const range = await this.resolveRange(organizationId, query);
    const timestamp = { gte: range.start, lt: range.endExclusive };
    const encounterLocation = range.locationId
      ? { clinicalEncounter: { is: { clinicLocationId: range.locationId } } }
      : {};
    const [
      encounters,
      prescriptions,
      vaccinations,
      dewormings,
      procedures,
      anesthesia,
      diagnostics,
      discharges,
      consents,
    ] = await Promise.all([
      this.prisma.clinicalEncounter.count({
        where: {
          organizationId,
          status: ClinicalEncounterStatus.FINALIZED,
          finalizedAt: timestamp,
          ...(range.locationId ? { clinicLocationId: range.locationId } : {}),
        },
      }),
      this.prisma.prescription.count({
        where: {
          organizationId,
          status: PrescriptionStatus.FINALIZED,
          finalizedAt: timestamp,
          ...encounterLocation,
        },
      }),
      this.prisma.vaccination.count({
        where: {
          organizationId,
          status: PreventiveRecordStatus.FINALIZED,
          finalizedAt: timestamp,
          ...encounterLocation,
        },
      }),
      this.prisma.deworming.count({
        where: {
          organizationId,
          status: PreventiveRecordStatus.FINALIZED,
          finalizedAt: timestamp,
          ...encounterLocation,
        },
      }),
      this.prisma.clinicalProcedure.count({
        where: {
          organizationId,
          status: ClinicalProcedureStatus.FINALIZED,
          finalizedAt: timestamp,
          ...encounterLocation,
        },
      }),
      this.prisma.anesthesiaRecord.count({
        where: {
          organizationId,
          status: AnesthesiaRecordStatus.FINALIZED,
          finalizedAt: timestamp,
          ...encounterLocation,
        },
      }),
      this.prisma.diagnosticOrder.count({
        where: {
          organizationId,
          status: DiagnosticOrderStatus.RESULTED,
          resultedAt: timestamp,
          ...encounterLocation,
        },
      }),
      this.prisma.hospitalization.count({
        where: {
          organizationId,
          status: HospitalizationStatus.DISCHARGED,
          dischargedAt: timestamp,
          ...(range.locationId
            ? { clinicalEncounter: { is: { clinicLocationId: range.locationId } } }
            : {}),
        },
      }),
      this.prisma.consent.count({
        where: {
          organizationId,
          status: ConsentStatus.SIGNED,
          signedAt: timestamp,
          ...encounterLocation,
        },
      }),
    ]);
    return {
      range: this.publicRange(range),
      finalized: {
        clinicalEncounters: encounters,
        prescriptions,
        vaccinations,
        dewormings,
        procedures,
        anesthesia,
        diagnosticOrdersResulted: diagnostics,
        hospitalizationDischarges: discharges,
        consentsSigned: consents,
      },
    };
  }

  async commercial(organizationId: string, query: ReportRangeDto) {
    const range = await this.resolveRange(organizationId, query);
    const location = range.locationId ? { clinicLocationId: range.locationId } : {};
    const timestamp = { gte: range.start, lt: range.endExclusive };
    const [completed, voided, payments, issuedInvoices, voidedInvoices, cashSessions] =
      await Promise.all([
        this.prisma.sale.groupBy({
          by: ['currencyCode'],
          where: {
            organizationId,
            status: SaleStatus.COMPLETED,
            completedAt: timestamp,
            ...location,
          },
          _count: { _all: true },
          _sum: { grandTotal: true, discountTotal: true },
          _avg: { grandTotal: true },
        }),
        this.prisma.sale.groupBy({
          by: ['currencyCode'],
          where: { organizationId, status: SaleStatus.VOIDED, voidedAt: timestamp, ...location },
          _count: { _all: true },
          _sum: { grandTotal: true },
        }),
        this.prisma.$queryRaw<Array<{ currencyCode: string; method: string; total: string }>>`
        SELECT s.currency_code AS "currencyCode", p.method::text AS method,
               COALESCE(SUM(p.amount), 0)::text AS total
        FROM sale_payments p
        INNER JOIN sales s ON s.id = p.sale_id AND s.organization_id = p.organization_id
        WHERE p.organization_id = ${organizationId}::uuid
          AND p.status = ${SalePaymentStatus.POSTED}::"SalePaymentStatus"
          AND s.status = ${SaleStatus.COMPLETED}::"SaleStatus"
          AND p.paid_at >= ${range.start} AND p.paid_at < ${range.endExclusive}
          AND (${range.locationId ?? null}::uuid IS NULL OR s.clinic_location_id = ${range.locationId ?? null}::uuid)
        GROUP BY s.currency_code, p.method
        ORDER BY s.currency_code, p.method
      `,
        this.prisma.invoice.count({
          where: {
            organizationId,
            status: InvoiceStatus.ISSUED,
            issuedAt: timestamp,
            ...(range.locationId ? { sale: { is: location } } : {}),
          },
        }),
        this.prisma.invoice.count({
          where: {
            organizationId,
            status: InvoiceStatus.VOIDED,
            voidedAt: timestamp,
            ...(range.locationId ? { sale: { is: location } } : {}),
          },
        }),
        this.prisma.cashSession.groupBy({
          by: ['currencyCode'],
          where: {
            organizationId,
            status: CashSessionStatus.CLOSED,
            closedAt: timestamp,
            ...location,
          },
          _count: { _all: true },
          _sum: { differenceAmount: true },
        }),
      ]);
    const byCurrency = new Map<
      string,
      {
        currencyCode: string;
        completedSales: number;
        voidedSales: number;
        revenue: string;
        discounts: string;
        averageTicket: string;
        voidedValue: string;
      }
    >();
    const ensureCurrency = (currencyCode: string) => {
      const current = byCurrency.get(currencyCode);
      if (current) return current;
      const created = {
        currencyCode,
        completedSales: 0,
        voidedSales: 0,
        revenue: '0',
        discounts: '0',
        averageTicket: '0',
        voidedValue: '0',
      };
      byCurrency.set(currencyCode, created);
      return created;
    };
    for (const row of completed) {
      Object.assign(ensureCurrency(row.currencyCode), {
        completedSales: row._count._all,
        revenue: row._sum.grandTotal?.toString() ?? '0',
        discounts: row._sum.discountTotal?.toString() ?? '0',
        averageTicket: row._avg.grandTotal?.toString() ?? '0',
      });
    }
    for (const row of voided) {
      Object.assign(ensureCurrency(row.currencyCode), {
        voidedSales: row._count._all,
        voidedValue: row._sum.grandTotal?.toString() ?? '0',
      });
    }
    for (const row of payments) ensureCurrency(row.currencyCode);
    for (const row of cashSessions) ensureCurrency(row.currencyCode);
    return {
      range: this.publicRange(range),
      totalsByCurrency: [...byCurrency.values()].sort((a, b) =>
        a.currencyCode.localeCompare(b.currencyCode),
      ),
      paymentsByCurrency: payments.map((row) => ({
        currencyCode: row.currencyCode,
        method: row.method,
        total: row.total,
      })),
      invoices: {
        issued: issuedInvoices,
        voided: voidedInvoices,
      },
      cashSessionsByCurrency: cashSessions.map((row) => ({
        currencyCode: row.currencyCode,
        closedSessions: row._count._all,
        difference: row._sum.differenceAmount?.toString() ?? '0',
      })),
    };
  }

  async inventory(organizationId: string, query: ReportRangeDto) {
    const range = await this.resolveRange(organizationId, query);
    const locationId = range.locationId ?? null;
    const today = range.todayText;
    const soon = DateTime.fromISO(today, { zone: range.timezone }).plus({ days: 30 }).toISODate()!;
    const date = { gte: range.start, lt: range.endExclusive };
    const [activeItems, archivedItems, lowStockRows, expiredRows, expiringRows, movements] =
      await Promise.all([
        this.prisma.inventoryItem.count({
          where: { organizationId, status: InventoryItemStatus.ACTIVE },
        }),
        this.prisma.inventoryItem.count({
          where: { organizationId, status: InventoryItemStatus.ARCHIVED },
        }),
        this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count FROM (
          SELECT i.id, m.clinic_location_id
          FROM inventory_items i
          INNER JOIN inventory_movements m
            ON m.inventory_item_id = i.id AND m.organization_id = i.organization_id
          WHERE i.organization_id = ${organizationId}::uuid
            AND i.status = ${InventoryItemStatus.ACTIVE}::"InventoryItemStatus"
            AND i.minimum_stock IS NOT NULL
            AND (${locationId}::uuid IS NULL OR m.clinic_location_id = ${locationId}::uuid)
          GROUP BY i.id, m.clinic_location_id, i.minimum_stock
          HAVING SUM(m.quantity_delta) <= i.minimum_stock
        ) low_stock
      `,
        this.countPositiveStockBatches(organizationId, locationId, '<', today),
        this.countPositiveStockBatches(organizationId, locationId, 'between', today, soon),
        this.prisma.inventoryMovement.count({
          where: {
            organizationId,
            occurredAt: date,
            ...(range.locationId ? { clinicLocationId: range.locationId } : {}),
          },
        }),
      ]);
    return {
      range: this.publicRange(range),
      activeItems,
      archivedItems,
      lowStockItemLocations: lowStockRows[0]?.count ?? 0,
      expiredBatchesWithStock: expiredRows[0]?.count ?? 0,
      expiringSoonBatchesWithStock: expiringRows[0]?.count ?? 0,
      stockMovements: movements,
    };
  }

  private async countPositiveStockBatches(
    organizationId: string,
    locationId: string | null,
    mode: 'between' | '<',
    start: string,
    end?: string,
  ) {
    if (mode === '<') {
      const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count FROM (
          SELECT b.id
          FROM inventory_batches b
          INNER JOIN inventory_movements m
            ON m.inventory_batch_id = b.id AND m.organization_id = b.organization_id
          WHERE b.organization_id = ${organizationId}::uuid
            AND b.expiry_on < ${start}::date
            AND (${locationId}::uuid IS NULL OR m.clinic_location_id = ${locationId}::uuid)
          GROUP BY b.id
          HAVING SUM(m.quantity_delta) > 0
        ) positive_batches
      `;
      return rows;
    }
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count FROM (
        SELECT b.id
        FROM inventory_batches b
        INNER JOIN inventory_movements m
          ON m.inventory_batch_id = b.id AND m.organization_id = b.organization_id
        WHERE b.organization_id = ${organizationId}::uuid
          AND b.expiry_on >= ${start}::date AND b.expiry_on <= ${end}::date
          AND (${locationId}::uuid IS NULL OR m.clinic_location_id = ${locationId}::uuid)
        GROUP BY b.id
        HAVING SUM(m.quantity_delta) > 0
      ) positive_batches
    `;
    return rows;
  }

  private async resolveRange(organizationId: string, query: ReportRangeDto): Promise<Range> {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, status: 'ACTIVE' },
      select: { timezone: true },
    });
    if (!organization)
      throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
    if (query.clinicLocationId) {
      const location = await this.prisma.clinicLocation.findFirst({
        where: { id: query.clinicLocationId, organizationId },
        select: { id: true },
      });
      if (!location)
        throw new NotFoundException({ code: 'LOCATION_NOT_FOUND', message: 'Location not found' });
    }
    const today = DateTime.now().setZone(organization.timezone).startOf('day');
    const fromText = query.from ?? today.minus({ days: 29 }).toISODate()!;
    const toText = query.to ?? today.toISODate()!;
    const from = DateTime.fromISO(fromText, { zone: organization.timezone });
    const to = DateTime.fromISO(toText, { zone: organization.timezone });
    if (
      !from.isValid ||
      !to.isValid ||
      from.toISODate() !== fromText ||
      to.toISODate() !== toText ||
      to.toMillis() < from.toMillis() ||
      to.diff(from, 'days').days > 365
    ) {
      throw new BadRequestException({
        code: 'INVALID_REPORT_RANGE',
        message: 'Use a valid civil date range of at most 366 days',
      });
    }
    return {
      from: fromText,
      to: toText,
      timezone: organization.timezone,
      start: from.startOf('day').toUTC().toJSDate(),
      endExclusive: to.plus({ days: 1 }).startOf('day').toUTC().toJSDate(),
      today: today.toJSDate(),
      todayText: today.toISODate()!,
      ...(query.clinicLocationId ? { locationId: query.clinicLocationId } : {}),
    };
  }

  private publicRange(range: Range) {
    return {
      from: range.from,
      to: range.to,
      timezone: range.timezone,
      clinicLocationId: range.locationId ?? null,
    };
  }

  private civilDate(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  private statusCounts<T extends string>(rows: Array<{ status: T; _count: { _all: number } }>) {
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all])) as Record<
      T,
      number
    >;
  }
}
