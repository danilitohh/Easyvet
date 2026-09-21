import type { PrescriptionStatus } from '@veterinary-saas/contracts';

export const PRESCRIPTION_STATUS_LABEL: Record<PrescriptionStatus, string> = {
  DRAFT: 'Borrador',
  FINALIZED: 'Finalizada',
  VOIDED: 'Anulada',
};

export function prescriptionStatusTone(
  status: PrescriptionStatus,
): 'neutral' | 'success' | 'danger' {
  if (status === 'FINALIZED') return 'success';
  if (status === 'VOIDED') return 'danger';
  return 'neutral';
}

export function prescriptionStatusLabel(status: PrescriptionStatus): string {
  return PRESCRIPTION_STATUS_LABEL[status];
}

export function historicalProfessional(
  status: PrescriptionStatus,
  snapshot: string | null,
  current: string | null | undefined,
): string {
  if (status !== 'DRAFT') return snapshot?.trim() || 'Snapshot profesional no disponible';
  return current?.trim() || 'Sin prescriptor asignado';
}

export function compactId(id: string): string {
  return id.slice(0, 8);
}
