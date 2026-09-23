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
  InventoryItemStatus,
  InvoiceStatus,
  OwnerStatus,
  PatientStatus,
  Prisma,
  SaleItemType,
  SalePaymentMethod,
  SalePaymentStatus,
  SaleStatus,
} from '@prisma/client';
import type {
  CommercialPage,
  SaleDetail,
  SaleListQuery,
  SaleListResponse,
} from '@veterinary-saas/contracts';
import type { TenantContext } from '../authorization/authorization.types';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../infrastructure/database/prisma.service';
import type {
  CompleteSaleDto,
  CreateSaleDto,
  SaleItemInputDto,
  UpdateSaleDto,
  VoidSaleDto,
} from './commercial.dto';
import { saleInclude, toSaleDetail, toSaleSummary, type SaleRecord } from './commercial.mapper';

type Transaction = Prisma.TransactionClient;
type CustomerSnapshot = {
  ownerId: string | null;
  patientId: string | null;
  customerName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  patientName: string | null;
};
type SaleLineData = {
  organizationId: string;
  saleId: string;
  position: number;
  itemType: SaleItemType;
  inventoryItemId: string | null;
  inventoryBatchId: string | null;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
};

const ZERO = new Prisma.Decimal(0);
const MONEY_MAX = new Prisma.Decimal('9999999999999999.9999');

// A tenant-scoped 404 does not disclose whether an unrelated tenant's UUID exists.
function notFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

// Public commercial errors use stable codes and never expose database details.
function conflict(code: string, message: string): ConflictException {
  return new ConflictException({ code, message });
}

function validation(message: string): BadRequestException {
  return new BadRequestException({ code: 'VALIDATION_ERROR', message });
}

// Money is rounded once to the database scale and rejected before it can overflow NUMERIC(20,4).
function money(value: Prisma.Decimal): Prisma.Decimal {
  const rounded = value.toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP);
  if (rounded.isNegative() || rounded.gt(MONEY_MAX))
    throw validation('Monetary total exceeds supported precision');
  return rounded;
}

// Caller strings are parsed by Decimal rather than converted through floating point arithmetic.
function decimal(value: string): Prisma.Decimal {
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw validation('Invalid decimal value');
  }
}

// Audit records describe the action but deliberately omit customer documents, references and item text.
async function recordAudit(
  tx: Transaction,
  input: {
    organizationId: string;
    saleId: string;
    actorMembershipId: string;
    action: CommercialAuditAction;
    metadata?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await tx.commercialAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      saleId: input.saleId,
      actorMembershipId: input.actorMembershipId,
      action: input.action,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}

// SalesService owns the Sale lifecycle and coordinates stock, payments, cash and invoice issuance.
@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  // Lists only the active tenant's sales with bounded paging and stable newest-first ordering.
  async list(organizationId: string, query: SaleListQuery): Promise<SaleListResponse> {
    this.assertDateRange(query.from, query.to);
    const where: Prisma.SaleWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clinicLocationId ? { clinicLocationId: query.clinicLocationId } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.patientId ? { patientId: query.patientId } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: saleInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return this.page(records.map(toSaleSummary), query.page, query.pageSize, total);
  }

  // Reads a sale by both UUID and tenant; cross-tenant links therefore resolve to the same 404.
  async findOne(organizationId: string, saleId: string): Promise<SaleDetail> {
    const sale = await this.prisma.sale.findFirst({
      where: { id: saleId, organizationId },
      include: saleInclude,
    });
    if (!sale) throw notFound();
    return toSaleDetail(sale);
  }

  // Draft creation validates the active location, customer and inventory identities in one transaction.
  async create(tenant: TenantContext, input: CreateSaleDto): Promise<SaleDetail> {
    const saleId = await this.prisma.$transaction(async (tx) => {
      await this.lockActiveLocation(tx, tenant.organizationId, input.clinicLocationId);
      const customer = await this.resolveCustomer(
        tx,
        tenant.organizationId,
        input.ownerId ?? null,
        input.patientId ?? null,
      );
      const settings = await tx.organizationCommercialSettings.findUnique({
        where: { organizationId: tenant.organizationId },
        select: { currencyCode: true },
      });
      if (!settings) throw new Error('Organization commercial settings are missing');

      // Draft totals are derived before the first insert so version 1 remains the initial CAS revision.
      const totals = this.calculateTotals(
        (input.items ?? []).map((item) => ({
          quantity: decimal(item.quantity),
          unitPrice: decimal(item.unitPrice),
          discountAmount: decimal(item.discountAmount ?? '0'),
        })),
      );
      const sale = await tx.sale.create({
        data: {
          organizationId: tenant.organizationId,
          clinicLocationId: input.clinicLocationId,
          ownerId: customer.ownerId,
          patientId: customer.patientId,
          currencyCode: settings.currencyCode,
          createdByMembershipId: tenant.membershipId,
          ...totals,
        },
        select: { id: true },
      });
      await this.buildLines(tx, tenant.organizationId, sale.id, input.items ?? []);
      await recordAudit(tx, {
        organizationId: tenant.organizationId,
        saleId: sale.id,
        actorMembershipId: tenant.membershipId,
        action: CommercialAuditAction.SALE_CREATED,
      });
      return sale.id;
    });
    return this.findOne(tenant.organizationId, saleId);
  }

  // Draft update is compare-and-swap and replaces lines only while the parent remains DRAFT.
  async update(tenant: TenantContext, saleId: string, input: UpdateSaleDto): Promise<SaleDetail> {
    await this.prisma.$transaction(async (tx) => {
      const current = await this.lockSale(tx, tenant.organizationId, saleId);
      this.assertDraftVersion(current, input.expectedVersion);
      await this.lockActiveLocation(tx, tenant.organizationId, input.clinicLocationId);
      const customer = await this.resolveCustomer(
        tx,
        tenant.organizationId,
        input.ownerId ?? null,
        input.patientId ?? null,
      );
      const lines = await this.buildLines(tx, tenant.organizationId, saleId, input.items ?? []);
      const totals = this.calculateTotals(lines);
      await tx.sale.update({
        where: { id_organizationId: { id: saleId, organizationId: tenant.organizationId } },
        data: {
          clinicLocationId: input.clinicLocationId,
          ownerId: customer.ownerId,
          patientId: customer.patientId,
          ...totals,
          version: { increment: 1 },
        },
      });
      await recordAudit(tx, {
        organizationId: tenant.organizationId,
        saleId,
        actorMembershipId: tenant.membershipId,
        action: CommercialAuditAction.SALE_UPDATED,
        metadata: { version: input.expectedVersion + 1 },
      });
    });
    return this.findOne(tenant.organizationId, saleId);
  }

  // Completion atomically commits stock, tender, cash evidence, invoice number and Sale lifecycle.
  async complete(
    tenant: TenantContext,
    saleId: string,
    input: CompleteSaleDto,
  ): Promise<SaleDetail> {
    await this.prisma.$transaction(async (tx) => {
      const sale = await this.lockSale(tx, tenant.organizationId, saleId);
      this.assertDraftVersion(sale, input.expectedVersion);
      if (sale.items.length === 0)
        throw validation('A sale requires at least one line before completion');
      const customer = await this.resolveCustomer(
        tx,
        tenant.organizationId,
        sale.patientId ? null : sale.ownerId,
        sale.patientId,
      );
      const totals = this.calculateTotals(sale.items);
      const paymentTotal = input.payments.reduce(
        (sum, payment) => sum.plus(decimal(payment.amount)),
        ZERO,
      );
      if (paymentTotal.toDecimalPlaces(4).cmp(totals.grandTotal) !== 0) {
        throw validation('Payment amounts must equal the sale total exactly');
      }
      if (totals.grandTotal.isZero() && input.payments.length > 0) {
        throw validation('Zero-total sales must not include payment rows');
      }
      if (!totals.grandTotal.isZero() && input.payments.length === 0) {
        throw validation('A positive sale total requires at least one payment');
      }

      const occurredAt = new Date();
      const stockLines = sale.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        inventoryItemId: item.inventoryItemId,
        inventoryBatchId: item.inventoryBatchId,
        quantity: item.quantity,
      }));
      await this.inventory.consumeForSale(
        tx,
        tenant.organizationId,
        sale.clinicLocationId,
        sale.id,
        tenant.membershipId,
        stockLines,
        occurredAt,
      );

      const cashPayments = input.payments.filter(
        (payment) => payment.method === SalePaymentMethod.CASH,
      );
      let cashSessionId: string | null = null;
      if (cashPayments.length > 0) {
        cashSessionId = await this.lockOpenCashSession(
          tx,
          tenant.organizationId,
          sale.clinicLocationId,
        );
        if (!cashSessionId) {
          throw conflict(
            'CASH_SESSION_REQUIRED',
            'Open a cash session for this location before collecting cash',
          );
        }
      }

      const settings = await this.lockCommercialSettings(tx, tenant.organizationId);
      const invoiceNumber = `${settings.invoicePrefix}-${String(settings.nextInvoiceNumber).padStart(6, '0')}`;
      await tx.organizationCommercialSettings.update({
        where: { organizationId: tenant.organizationId },
        data: { nextInvoiceNumber: { increment: 1 } },
      });

      for (const payment of input.payments) {
        const created = await tx.salePayment.create({
          data: {
            organizationId: tenant.organizationId,
            saleId,
            method: payment.method,
            amount: decimal(payment.amount),
            reference: payment.reference?.trim() || null,
            cashSessionId: payment.method === SalePaymentMethod.CASH ? cashSessionId : null,
            createdByMembershipId: tenant.membershipId,
            paidAt: occurredAt,
          },
          select: { id: true, amount: true, method: true, cashSessionId: true },
        });
        if (created.method === SalePaymentMethod.CASH && created.cashSessionId) {
          await tx.cashMovement.create({
            data: {
              organizationId: tenant.organizationId,
              cashSessionId: created.cashSessionId,
              movementType: CashMovementType.SALE_PAYMENT,
              amountDelta: created.amount,
              saleId,
              salePaymentId: created.id,
              occurredAt,
              createdByMembershipId: tenant.membershipId,
            },
          });
        }
      }
      if (cashSessionId) {
        await tx.cashSession.update({
          where: {
            id_organizationId: { id: cashSessionId, organizationId: tenant.organizationId },
          },
          data: { version: { increment: 1 } },
        });
      }

      await tx.invoice.create({
        data: {
          organizationId: tenant.organizationId,
          saleId,
          documentNumber: invoiceNumber,
          currencyCode: sale.currencyCode,
          customerNameSnapshot: customer.customerName,
          customerDocumentTypeSnapshot: customer.documentType,
          customerDocumentNumberSnapshot: customer.documentNumber,
          patientNameSnapshot: customer.patientName,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          total: totals.grandTotal,
          issuedAt: occurredAt,
        },
      });
      await tx.sale.update({
        where: { id_organizationId: { id: saleId, organizationId: tenant.organizationId } },
        data: {
          ...totals,
          status: SaleStatus.COMPLETED,
          completedAt: occurredAt,
          completedByMembershipId: tenant.membershipId,
          customerNameSnapshot: customer.customerName,
          customerDocumentTypeSnapshot: customer.documentType,
          customerDocumentNumberSnapshot: customer.documentNumber,
          patientNameSnapshot: customer.patientName,
          ownerId: customer.ownerId,
          version: { increment: 1 },
        },
      });
      await recordAudit(tx, {
        organizationId: tenant.organizationId,
        saleId,
        actorMembershipId: tenant.membershipId,
        action: CommercialAuditAction.SALE_COMPLETED,
        metadata: { invoiceIssued: true, itemCount: sale.items.length },
      });
    });
    return this.findOne(tenant.organizationId, saleId);
  }

  // Void uses append-only compensating stock/cash entries and refuses to cross a closed cash period.
  async void(tenant: TenantContext, saleId: string, input: VoidSaleDto): Promise<SaleDetail> {
    await this.prisma.$transaction(async (tx) => {
      const sale = await this.lockSale(tx, tenant.organizationId, saleId);
      if (sale.status !== SaleStatus.COMPLETED) {
        throw conflict('SALE_NOT_COMPLETED', 'Only completed sales can be voided');
      }
      if (sale.version !== input.expectedVersion) {
        throw conflict('SALE_STALE', 'The sale changed; reload it before retrying');
      }
      const reason = input.reason.trim();
      if (!reason) throw validation('A reason is required to void a sale');
      const occurredAt = new Date();
      await this.inventory.reverseSaleForVoid(
        tx,
        tenant.organizationId,
        sale.clinicLocationId,
        sale.id,
        tenant.membershipId,
        sale.items.map((item) => ({
          id: item.id,
          itemType: item.itemType,
          inventoryItemId: item.inventoryItemId,
          inventoryBatchId: item.inventoryBatchId,
          quantity: item.quantity,
        })),
        occurredAt,
      );

      const postedPayments = sale.payments.filter(
        (payment) => payment.status === SalePaymentStatus.POSTED,
      );
      const sessionIds = [
        ...new Set(
          postedPayments
            .filter((payment) => payment.method === SalePaymentMethod.CASH && payment.cashSessionId)
            .map((payment) => payment.cashSessionId as string),
        ),
      ].sort();
      const sessions = new Map<string, CashSessionStatus>();
      for (const sessionId of sessionIds) {
        const rows = await tx.$queryRaw<Array<{ id: string; status: CashSessionStatus }>>`
          SELECT id, status FROM cash_sessions
          WHERE id = ${sessionId}::uuid AND organization_id = ${tenant.organizationId}::uuid
          FOR UPDATE
        `;
        if (!rows[0]) throw notFound();
        sessions.set(rows[0].id, rows[0].status);
        if (rows[0].status !== CashSessionStatus.OPEN) {
          throw conflict(
            'SALE_CASH_SESSION_CLOSED',
            'A cash tender belongs to a closed cash session',
          );
        }
      }

      for (const payment of postedPayments) {
        if (payment.method === SalePaymentMethod.CASH && payment.cashSessionId) {
          await tx.cashMovement.create({
            data: {
              organizationId: tenant.organizationId,
              cashSessionId: payment.cashSessionId,
              movementType: CashMovementType.SALE_VOID_REVERSAL,
              amountDelta: payment.amount.negated(),
              saleId,
              occurredAt,
              reason: 'Anulación de venta',
              createdByMembershipId: tenant.membershipId,
            },
          });
        }
        await tx.salePayment.update({
          where: { id: payment.id },
          data: {
            status: SalePaymentStatus.VOIDED,
            voidedAt: occurredAt,
            voidedByMembershipId: tenant.membershipId,
          },
        });
      }
      for (const sessionId of sessionIds) {
        await tx.cashSession.update({
          where: { id_organizationId: { id: sessionId, organizationId: tenant.organizationId } },
          data: { version: { increment: 1 } },
        });
      }
      const invoice = await tx.invoice.findFirst({
        where: { saleId, organizationId: tenant.organizationId },
      });
      if (!invoice || invoice.status !== InvoiceStatus.ISSUED)
        throw conflict('INVOICE_STATE_INVALID', 'The sale invoice is not issuable for void');
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.VOIDED,
          voidedAt: occurredAt,
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason,
        },
      });
      await tx.sale.update({
        where: { id_organizationId: { id: saleId, organizationId: tenant.organizationId } },
        data: {
          status: SaleStatus.VOIDED,
          voidedAt: occurredAt,
          voidedByMembershipId: tenant.membershipId,
          voidReason: reason,
          version: { increment: 1 },
        },
      });
      await recordAudit(tx, {
        organizationId: tenant.organizationId,
        saleId,
        actorMembershipId: tenant.membershipId,
        action: CommercialAuditAction.SALE_VOIDED,
        metadata: { itemCount: sale.items.length, paymentCount: postedPayments.length },
      });
    });
    return this.findOne(tenant.organizationId, saleId);
  }

  // Draft CAS locks the aggregate root first and keeps all dependent writes within that lock.
  private async lockSale(
    tx: Transaction,
    organizationId: string,
    saleId: string,
  ): Promise<SaleRecord> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM sales WHERE id = ${saleId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE
    `;
    if (!rows[0]) throw notFound();
    const sale = await tx.sale.findFirst({
      where: { id: saleId, organizationId },
      include: saleInclude,
    });
    if (!sale) throw notFound();
    return sale;
  }

  // Draft state and version are checked after acquiring the row lock, avoiding last-write-wins updates.
  private assertDraftVersion(sale: SaleRecord, expectedVersion: number): void {
    if (sale.status !== SaleStatus.DRAFT)
      throw conflict('SALE_NOT_DRAFT', 'Only draft sales can be changed or completed');
    if (sale.version !== expectedVersion)
      throw conflict('SALE_STALE', 'The sale changed; reload it before retrying');
  }

  // Customer links are tenant-scoped, active and patient ownership is always derived server-side.
  private async resolveCustomer(
    tx: Transaction,
    organizationId: string,
    ownerId: string | null,
    patientId: string | null,
  ): Promise<CustomerSnapshot> {
    if (patientId) {
      const patientRows = await tx.$queryRaw<
        Array<{ id: string; ownerId: string; status: PatientStatus }>
      >`
        SELECT id, owner_id AS "ownerId", status FROM patients
        WHERE id = ${patientId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE
      `;
      const patient = patientRows[0];
      if (!patient) throw notFound();
      if (patient.status !== PatientStatus.ACTIVE)
        throw conflict('PATIENT_INACTIVE', 'An active patient is required');
      const derivedOwnerId = patient.ownerId;
      if (ownerId && ownerId !== derivedOwnerId) {
        throw validation('Owner is derived from the selected patient and cannot be overridden');
      }
      const owner = await this.loadActiveOwner(tx, organizationId, derivedOwnerId);
      const details = await tx.patient.findFirst({
        where: { id: patientId, organizationId },
        select: { name: true },
      });
      if (!details) throw notFound();
      return {
        ownerId: derivedOwnerId,
        patientId,
        customerName: `${owner.firstName} ${owner.lastName ?? ''}`.trim(),
        documentType: owner.documentType,
        documentNumber: owner.documentNumber,
        patientName: details.name,
      };
    }
    if (!ownerId) {
      return {
        ownerId: null,
        patientId: null,
        customerName: null,
        documentType: null,
        documentNumber: null,
        patientName: null,
      };
    }
    const owner = await this.loadActiveOwner(tx, organizationId, ownerId);
    return {
      ownerId,
      patientId: null,
      customerName: `${owner.firstName} ${owner.lastName ?? ''}`.trim(),
      documentType: owner.documentType,
      documentNumber: owner.documentNumber,
      patientName: null,
    };
  }

  // Owner locking serializes sale linkage against archive operations in the same tenant.
  private async loadActiveOwner(tx: Transaction, organizationId: string, ownerId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string; status: OwnerStatus }>>`
      SELECT id, status FROM owners
      WHERE id = ${ownerId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE
    `;
    if (!rows[0]) throw notFound();
    if (rows[0].status !== OwnerStatus.ACTIVE)
      throw conflict('OWNER_INACTIVE', 'An active owner is required');
    const owner = await tx.owner.findFirst({
      where: { id: ownerId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        documentType: true,
        documentNumber: true,
      },
    });
    if (!owner) throw notFound();
    return owner;
  }

  // Draft line replacement derives product labels from Inventory and rejects free-form stock identity.
  private async buildLines(
    tx: Transaction,
    organizationId: string,
    saleId: string,
    inputs: SaleItemInputDto[],
  ): Promise<SaleLineData[]> {
    const result: SaleLineData[] = [];
    for (const [position, input] of inputs.entries()) {
      const quantity = decimal(input.quantity);
      const unitPrice = decimal(input.unitPrice);
      const discountAmount = decimal(input.discountAmount ?? '0');
      const gross = money(quantity.mul(unitPrice));
      if (discountAmount.gt(gross))
        throw validation('A line discount cannot exceed its gross amount');
      let description = input.description?.trim() ?? '';
      let inventoryItemId: string | null = input.inventoryItemId ?? null;
      let inventoryBatchId: string | null = input.inventoryBatchId ?? null;
      if (input.itemType === SaleItemType.PRODUCT) {
        if (!inventoryItemId) throw validation('Product lines require an inventory item');
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: { id: inventoryItemId, organizationId, status: InventoryItemStatus.ACTIVE },
          select: { id: true, name: true, lotTracking: true },
        });
        if (!inventoryItem) throw notFound();
        if (inventoryItem.lotTracking && !inventoryBatchId) {
          throw validation('Select a batch for lot-tracked products');
        }
        if (!inventoryItem.lotTracking && inventoryBatchId) {
          throw validation('A batch cannot be selected for a product without lot tracking');
        }
        if (inventoryBatchId) {
          const batch = await tx.inventoryBatch.findFirst({
            where: { id: inventoryBatchId, inventoryItemId, organizationId },
            select: { id: true },
          });
          if (!batch) throw notFound();
        }
        description = inventoryItem.name;
      } else {
        if (inventoryItemId || inventoryBatchId)
          throw validation('Non-product lines cannot reference inventory');
        inventoryItemId = null;
        inventoryBatchId = null;
        if (!description) throw validation('Service and other lines require a description');
      }
      result.push({
        organizationId,
        saleId,
        position,
        itemType: input.itemType,
        inventoryItemId,
        inventoryBatchId,
        description,
        quantity,
        unitPrice,
        discountAmount,
      });
    }
    await tx.saleItem.deleteMany({ where: { saleId, organizationId } });
    if (result.length) await tx.saleItem.createMany({ data: result });
    return result;
  }

  // Totals use Decimal arithmetic, per-line four-place rounding and checked database precision.
  private calculateTotals(
    lines: Array<Pick<SaleLineData, 'quantity' | 'unitPrice' | 'discountAmount'>>,
  ): { subtotal: Prisma.Decimal; discountTotal: Prisma.Decimal; grandTotal: Prisma.Decimal } {
    let subtotal = ZERO;
    let discountTotal = ZERO;
    for (const line of lines) {
      const gross = money(line.quantity.mul(line.unitPrice));
      if (line.discountAmount.isNegative() || line.discountAmount.gt(gross)) {
        throw validation('A line discount cannot exceed its gross amount');
      }
      subtotal = money(subtotal.plus(gross));
      discountTotal = money(discountTotal.plus(line.discountAmount));
    }
    return { subtotal, discountTotal, grandTotal: money(subtotal.minus(discountTotal)) };
  }

  // Active location validation is used by draft writes; completion follows inventory's lock order.
  private async lockActiveLocation(
    tx: Transaction,
    organizationId: string,
    locationId: string,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string; status: string }>>`
      SELECT id, status FROM clinic_locations
      WHERE id = ${locationId}::uuid AND organization_id = ${organizationId}::uuid FOR UPDATE
    `;
    if (!rows[0]) throw notFound();
    if (rows[0].status !== 'ACTIVE')
      throw conflict('LOCATION_INACTIVE', 'Sales require an active location');
  }

  // Cash tender rows serialize with session close before any payment or drawer evidence is written.
  private async lockOpenCashSession(
    tx: Transaction,
    organizationId: string,
    locationId: string,
  ): Promise<string | null> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM cash_sessions
      WHERE organization_id = ${organizationId}::uuid
        AND clinic_location_id = ${locationId}::uuid
        AND status = 'OPEN'
      FOR UPDATE
    `;
    return rows[0]?.id ?? null;
  }

  // The organization row lock allocates an invoice number without collisions under concurrent completion.
  private async lockCommercialSettings(
    tx: Transaction,
    organizationId: string,
  ): Promise<{ invoicePrefix: string; nextInvoiceNumber: number }> {
    const rows = await tx.$queryRaw<Array<{ invoicePrefix: string; nextInvoiceNumber: number }>>`
      SELECT invoice_prefix AS "invoicePrefix", next_invoice_number AS "nextInvoiceNumber"
      FROM organization_commercial_settings
      WHERE organization_id = ${organizationId}::uuid
      FOR UPDATE
    `;
    if (!rows[0]) throw new Error('Organization commercial settings are missing');
    return rows[0];
  }

  // Pagination metadata is identical for list endpoints and avoids exposing Prisma result internals.
  private page<T>(data: T[], page: number, pageSize: number, total: number): CommercialPage<T> {
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

  // Invalid ranges fail consistently instead of silently producing an empty list.
  private assertDateRange(from?: string, to?: string): void {
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      throw validation('from must be earlier than or equal to to');
    }
  }
}
