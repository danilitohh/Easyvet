import type { SaleItemType, SalePaymentMethod } from '@veterinary-saas/contracts';

const MONEY_SCALE = 4n;
const QUANTITY_SCALE = 6n;

// Fixed-point parsing keeps browser calculations exact and rejects exponent/locale notation.
export function toUnits(value: string, scale: bigint): bigint {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) return 0n;
  const [wholeValue, fraction = ''] = normalized.split('.');
  const whole = wholeValue ?? '0';
  const width = Number(scale);
  return (
    BigInt(whole) * 10n ** scale +
    BigInt((fraction.slice(0, width) + '0'.repeat(width)).slice(0, width))
  );
}

// API money is represented at four fixed decimal places without floating-point intermediates.
export function moneyUnits(value: string): bigint {
  return toUnits(value, MONEY_SCALE);
}

export function quantityUnits(value: string): bigint {
  return toUnits(value, QUANTITY_SCALE);
}

export function unitsToDecimal(value: bigint, scale: bigint, trim = true): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const width = Number(scale);
  const factor = 10n ** scale;
  const whole = absolute / factor;
  const fraction = String(absolute % factor).padStart(width, '0');
  const cleanFraction = trim ? fraction.replace(/0+$/, '') : fraction;
  return `${negative ? '-' : ''}${whole}${cleanFraction ? `.${cleanFraction}` : ''}`;
}

// Decimal quantity × unit price rounds half-up to the database's four-place money precision.
export function lineSubtotal(quantity: string, unitPrice: string): bigint {
  const product = quantityUnits(quantity) * moneyUnits(unitPrice);
  const divisor = 10n ** QUANTITY_SCALE;
  return (product + divisor / 2n) / divisor;
}

export function calculateTotals(
  lines: Array<{ quantity: string; unitPrice: string; discountAmount: string }>,
) {
  const subtotal = lines.reduce(
    (total, line) => total + lineSubtotal(line.quantity, line.unitPrice),
    0n,
  );
  const discountTotal = lines.reduce((total, line) => total + moneyUnits(line.discountAmount), 0n);
  return { subtotal, discountTotal, grandTotal: subtotal - discountTotal };
}

// BigInt currency formatting preserves exact integer grouping and never converts money to Number.
export function formatMoney(value: string, currency: string, locale = 'es-CO'): string {
  const negative = value.startsWith('-');
  const units = moneyUnits(negative ? value.slice(1) : value);
  const absolute = units;
  const factor = 10n ** MONEY_SCALE;
  const whole = absolute / factor;
  const fraction = String(absolute % factor).padStart(Number(MONEY_SCALE), '0');
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    currencyDisplay: 'narrowSymbol',
  });
  const currencyDigits =
    new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  const meaningfulDigits = fraction.replace(/0+$/, '').length;
  const visibleDigits = Math.max(
    currencyDigits,
    meaningfulDigits > 0 ? Math.max(2, meaningfulDigits) : 0,
  );
  const decimal =
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')
      ?.value ?? ',';
  const groupedWhole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(whole);
  const formatted = currencyFormatter
    .formatToParts(negative ? -1n : 1n)
    .map((part) => {
      if (part.type === 'integer') return groupedWhole;
      if (part.type === 'minusSign') return negative ? part.value : '';
      return part.value;
    })
    .join('');
  const insertion = formatted.indexOf(groupedWhole) + groupedWhole.length;
  const fractionValue = visibleDigits
    ? `${decimal}${fraction.slice(0, visibleDigits).padEnd(visibleDigits, '0')}`
    : '';
  return `${formatted.slice(0, insertion)}${fractionValue}${formatted.slice(insertion)}`;
}

export const SALE_STATUS_LABEL: Record<'DRAFT' | 'COMPLETED' | 'VOIDED', string> = {
  DRAFT: 'Borrador',
  COMPLETED: 'Completada',
  VOIDED: 'Anulada',
};

export const PAYMENT_METHOD_LABEL: Record<SalePaymentMethod, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  OTHER: 'Otro medio',
};

export const ITEM_TYPE_LABEL: Record<SaleItemType, string> = {
  PRODUCT: 'Producto',
  SERVICE: 'Servicio',
  OTHER: 'Otro',
};

// Local datetime controls use local wall time; the API receives an explicit instant.
export function currentLocalDateTime(): string {
  return new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
