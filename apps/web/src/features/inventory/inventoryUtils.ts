import type { InventoryItemType, InventoryMovementType } from '@veterinary-saas/contracts';

export const INVENTORY_ITEM_TYPE_LABEL: Record<InventoryItemType, string> = {
  MEDICATION: 'Medicamento',
  SUPPLY: 'Suministro',
  RETAIL: 'Venta al detal',
  OTHER: 'Otro',
};

export const INVENTORY_MOVEMENT_LABEL: Record<InventoryMovementType, string> = {
  RECEIPT: 'Entrada',
  ISSUE: 'Salida',
  ADJUSTMENT_IN: 'Ajuste de aumento',
  ADJUSTMENT_OUT: 'Ajuste de disminución',
  TRANSFER_IN: 'Traslado recibido',
  TRANSFER_OUT: 'Traslado enviado',
};

// Quantity display stays string-only to avoid introducing floating-point rounding in the UI.
export function displayQuantity(value: string | null | undefined): string {
  if (!value) return '—';
  return value.includes('.') ? value.replace(/0+$/, '').replace(/\.$/, '') : value;
}

// Civil expiry dates are displayed directly from the YYYY-MM-DD value, never parsed as an instant.
export function displayCivilDate(value: string | null): string {
  if (!value) return 'Sin vencimiento';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

// Operational timestamps are rendered in the organization's timezone and retain their instant.
export function displayInventoryInstant(value: string, timezone = 'America/Bogota'): string {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

// datetime-local receives a local wall-clock value while the API receives an explicit UTC instant.
export function currentLocalDateTimeInput(): string {
  const localDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function inventoryExpiryLabel(status: string): string {
  if (status === 'EXPIRED') return 'Vencido';
  if (status === 'EXPIRING_SOON') return 'Próximo a vencer';
  if (status === 'NO_EXPIRY') return 'Sin vencimiento';
  return 'Vigente';
}
