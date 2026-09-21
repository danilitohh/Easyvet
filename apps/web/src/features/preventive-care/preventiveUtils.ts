import type { PreventiveRecordStatus } from '@veterinary-saas/contracts';

export const PREVENTIVE_STATUS_LABEL: Record<PreventiveRecordStatus, string> = {
  DRAFT: 'Borrador',
  FINALIZED: 'Finalizado',
  VOIDED: 'Anulado',
};

export function preventiveStatusTone(
  status: PreventiveRecordStatus,
): 'neutral' | 'success' | 'danger' {
  if (status === 'FINALIZED') return 'success';
  if (status === 'VOIDED') return 'danger';
  return 'neutral';
}

// Civil dates are rendered from their components so the browser timezone cannot shift the day.
export function formatCivilDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function present(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

export function professionalDisplay(
  status: PreventiveRecordStatus,
  snapshot: string | null,
  liveDisplayName: string | null | undefined,
): string {
  if (status !== 'DRAFT') return snapshot?.trim() || 'Snapshot profesional no disponible';
  return liveDisplayName?.trim() || 'Sin asignar';
}

export function administeredByDisplay(
  status: PreventiveRecordStatus,
  snapshot: string | null,
  liveDisplayName: string | null | undefined,
): string | null {
  if (status !== 'DRAFT') return snapshot?.trim() || null;
  return liveDisplayName?.trim() || null;
}

export function historicalPatientDisplay(
  status: PreventiveRecordStatus,
  snapshot: string | null,
  current: string,
): string {
  return status === 'DRAFT' ? current : snapshot?.trim() || current;
}
