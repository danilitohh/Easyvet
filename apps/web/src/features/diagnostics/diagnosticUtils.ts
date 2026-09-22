import type { DiagnosticCategory, DiagnosticOrderStatus } from '@veterinary-saas/contracts';

export const DIAGNOSTIC_CATEGORY_LABEL: Record<DiagnosticCategory, string> = {
  LABORATORY: 'Laboratorio',
  IMAGING: 'Imagenología',
  PATHOLOGY: 'Patología',
  OTHER: 'Otro estudio',
};

export const DIAGNOSTIC_STATUS_LABEL: Record<DiagnosticOrderStatus, string> = {
  DRAFT: 'Borrador',
  REQUESTED: 'Solicitado',
  RESULTED: 'Con resultado',
  VOIDED: 'Anulado',
};

export function diagnosticStatusTone(status: DiagnosticOrderStatus) {
  if (status === 'RESULTED') return 'success';
  if (status === 'VOIDED') return 'danger';
  return 'warning';
}

// Converts an instant to a local datetime field without shifting the organization timezone.
export function localDateTimeFromInstant(value: string | null, timezone: string): string {
  if (!value) return '';
  const instant = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const field = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${field.year}-${field.month}-${field.day}T${field.hour}:${field.minute}`;
}

export function currentDiagnosticDateTime(timezone: string): string {
  return localDateTimeFromInstant(new Date().toISOString(), timezone);
}
