import { Prisma } from '@prisma/client';
import type {
  CashMovement,
  CashSession,
  CashSessionDetail,
  InvoiceDetail,
  InvoiceSummary,
  SaleDetail,
  SaleItem,
  SalePayment,
  SaleSummary,
} from '@veterinary-saas/contracts';

// Shared projections keep Decimal instances and unrelated tenant data out of commercial responses.
export const saleInclude = {
  clinicLocation: { select: { id: true, name: true } },
  items: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
  payments: { orderBy: [{ paidAt: 'asc' as const }, { id: 'asc' as const }] },
  invoice: { select: { id: true, documentNumber: true, status: true } },
} satisfies Prisma.SaleInclude;

export const invoiceInclude = {
  sale: {
    include: {
      clinicLocation: { select: { id: true, name: true } },
      items: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
      payments: { orderBy: [{ paidAt: 'asc' as const }, { id: 'asc' as const }] },
    },
  },
  organization: { select: { name: true } },
} satisfies Prisma.InvoiceInclude;

export const cashSessionInclude = {
  clinicLocation: { select: { id: true, name: true } },
} satisfies Prisma.CashSessionInclude;

export const cashMovementSelect = {
  id: true,
  cashSessionId: true,
  saleId: true,
  movementType: true,
  amountDelta: true,
  salePaymentId: true,
  occurredAt: true,
  reason: true,
  reference: true,
  createdAt: true,
} satisfies Prisma.CashMovementSelect;

export type SaleRecord = Prisma.SaleGetPayload<{ include: typeof saleInclude }>;
export type InvoiceRecord = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;
export type CashSessionRecord = Prisma.CashSessionGetPayload<{
  include: typeof cashSessionInclude;
}>;
export type CashMovementRecord = Prisma.CashMovementGetPayload<{
  select: typeof cashMovementSelect;
}>;

// Monetary and quantity values cross HTTP only as exact decimal strings.
export function toSaleItem(item: SaleRecord['items'][number]): SaleItem {
  return {
    id: item.id,
    position: item.position,
    itemType: item.itemType,
    inventoryItemId: item.inventoryItemId,
    inventoryBatchId: item.inventoryBatchId,
    description: item.description,
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toFixed(4),
    discountAmount: item.discountAmount.toFixed(4),
    inventoryItemNameSnapshot: item.inventoryItemNameSnapshot,
    skuSnapshot: item.skuSnapshot,
    baseUnitSnapshot: item.baseUnitSnapshot,
  };
}

// Tender summaries include only currently posted tenders after a sale correction.
export function toSalePayment(payment: SaleRecord['payments'][number]): SalePayment {
  return {
    id: payment.id,
    method: payment.method,
    status: payment.status,
    amount: payment.amount.toFixed(4),
    reference: payment.reference,
    cashSessionId: payment.cashSessionId,
    paidAt: payment.paidAt.toISOString(),
    voidedAt: payment.voidedAt?.toISOString() ?? null,
  };
}

// Sale list and detail share a stable projection while detail adds the immutable transaction evidence.
export function toSaleSummary(sale: SaleRecord): SaleSummary {
  const methods = new Map<string, Prisma.Decimal>();
  for (const payment of sale.payments) {
    if (payment.status !== 'POSTED') continue;
    methods.set(
      payment.method,
      (methods.get(payment.method) ?? new Prisma.Decimal(0)).plus(payment.amount),
    );
  }
  return {
    id: sale.id,
    organizationId: sale.organizationId,
    clinicLocationId: sale.clinicLocationId,
    clinicLocationName: sale.clinicLocation.name,
    ownerId: sale.ownerId,
    patientId: sale.patientId,
    status: sale.status,
    version: sale.version,
    currencyCode: sale.currencyCode,
    subtotal: sale.subtotal.toFixed(4),
    discountTotal: sale.discountTotal.toFixed(4),
    grandTotal: sale.grandTotal.toFixed(4),
    customerNameSnapshot: sale.customerNameSnapshot,
    patientNameSnapshot: sale.patientNameSnapshot,
    paymentSummary: [...methods].map(([method, amount]) => ({
      method: method as SaleSummary['paymentSummary'][number]['method'],
      amount: amount.toFixed(4),
    })),
    createdAt: sale.createdAt.toISOString(),
    completedAt: sale.completedAt?.toISOString() ?? null,
    voidedAt: sale.voidedAt?.toISOString() ?? null,
  };
}

// Full sale output adds safe customer snapshots, ordered lines, tender status and invoice identity.
export function toSaleDetail(sale: SaleRecord): SaleDetail {
  return {
    ...toSaleSummary(sale),
    customerDocumentTypeSnapshot: sale.customerDocumentTypeSnapshot,
    customerDocumentNumberSnapshot: sale.customerDocumentNumberSnapshot,
    createdByMembershipId: sale.createdByMembershipId,
    completedByMembershipId: sale.completedByMembershipId,
    voidedByMembershipId: sale.voidedByMembershipId,
    voidReason: sale.voidReason,
    items: sale.items.map(toSaleItem),
    payments: sale.payments.map(toSalePayment),
    invoice: sale.invoice,
  };
}

// Invoice headers are read from the immutable sale record, avoiding a duplicate line-item source.
export function toInvoiceSummary(invoice: InvoiceRecord): InvoiceSummary {
  return {
    id: invoice.id,
    saleId: invoice.saleId,
    clinicLocationId: invoice.sale.clinicLocationId,
    clinicLocationName: invoice.sale.clinicLocation.name,
    documentNumber: invoice.documentNumber,
    status: invoice.status,
    currencyCode: invoice.currencyCode,
    customerNameSnapshot: invoice.customerNameSnapshot,
    patientNameSnapshot: invoice.patientNameSnapshot,
    subtotal: invoice.subtotal.toFixed(4),
    discountTotal: invoice.discountTotal.toFixed(4),
    total: invoice.total.toFixed(4),
    issuedAt: invoice.issuedAt.toISOString(),
  };
}

// Invoice details reuse frozen SaleItems and tenders and expose no mutable editing surface.
export function toInvoiceDetail(invoice: InvoiceRecord): InvoiceDetail {
  return {
    ...toInvoiceSummary(invoice),
    organizationName: invoice.organization.name,
    customerDocumentTypeSnapshot: invoice.customerDocumentTypeSnapshot,
    customerDocumentNumberSnapshot: invoice.customerDocumentNumberSnapshot,
    voidedAt: invoice.voidedAt?.toISOString() ?? null,
    voidReason: invoice.voidReason,
    items: invoice.sale.items.map(toSaleItem),
    payments: invoice.sale.payments.map(toSalePayment),
  };
}

// Cash balances are derived from the append-only ledger or the final close snapshot.
export function toCashSession(
  session: CashSessionRecord,
  ledgerTotal: Prisma.Decimal,
): CashSession {
  const liveExpected = session.openingCashAmount.plus(ledgerTotal);
  return {
    id: session.id,
    organizationId: session.organizationId,
    clinicLocationId: session.clinicLocationId,
    clinicLocationName: session.clinicLocation.name,
    status: session.status,
    version: session.version,
    openingCashAmount: session.openingCashAmount.toFixed(4),
    openedAt: session.openedAt.toISOString(),
    openedByMembershipId: session.openedByMembershipId,
    closedAt: session.closedAt?.toISOString() ?? null,
    closedByMembershipId: session.closedByMembershipId,
    expectedCashAmount: (session.expectedCashAmount ?? liveExpected).toFixed(4),
    countedCashAmount: session.countedCashAmount?.toFixed(4) ?? null,
    differenceAmount: session.differenceAmount?.toFixed(4) ?? null,
    notes: session.notes,
  };
}

// The dedicated movement endpoint returns signed ledger values without customer or payment references.
export function toCashMovement(movement: CashMovementRecord): CashMovement {
  return {
    ...movement,
    amountDelta: movement.amountDelta.toFixed(4),
    occurredAt: movement.occurredAt.toISOString(),
    createdAt: movement.createdAt.toISOString(),
  };
}

// Session details are intended for the bounded movement-history endpoint and the active drawer UI.
export function toCashSessionDetail(
  session: CashSessionRecord,
  ledgerTotal: Prisma.Decimal,
  movements: CashMovementRecord[],
): CashSessionDetail {
  return { ...toCashSession(session, ledgerTotal), movements: movements.map(toCashMovement) };
}
