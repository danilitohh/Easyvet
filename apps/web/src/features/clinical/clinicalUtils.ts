import type {
  ClinicalEncounterResponse,
  ClinicalEncounterStatus,
  ClinicalEvolutionResponse,
  ClinicalVitalResponse,
} from '@veterinary-saas/contracts';

export const ENCOUNTER_STATUS_LABEL: Record<ClinicalEncounterStatus, string> = {
  DRAFT: 'Borrador',
  FINALIZED: 'Finalizado',
  VOIDED: 'Anulado',
};

export function statusTone(status: ClinicalEncounterStatus): 'neutral' | 'success' | 'danger' {
  if (status === 'FINALIZED') return 'success';
  if (status === 'VOIDED') return 'danger';
  return 'neutral';
}

export function formatDateTime(value: string | null | undefined, timezone: string): string {
  if (!value) return 'No registrado';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(value),
    );
  }
}

export function ownerDisplayName(owner: { firstName: string; lastName: string | null }): string {
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ');
}

export function professionalDisplayName(encounter: ClinicalEncounterResponse): string {
  // Terminal encounters are historical evidence: never replace a missing snapshot with a live
  // ProfessionalProfile value. Drafts may still preview the current responsible profile.
  if (encounter.status !== 'DRAFT') {
    return (
      encounter.professionalDisplayNameSnapshot?.trim() || 'Snapshot profesional no disponible'
    );
  }
  return (
    encounter.professionalDisplayNameSnapshot?.trim() ||
    encounter.responsibleProfessional?.displayName ||
    'Sin asignar'
  );
}

export function present(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

export function vitalValues(vital: ClinicalVitalResponse): Array<[string, string]> {
  const values: Array<[string, string]> = [];
  if (vital.weightKg !== null) values.push(['Peso', `${vital.weightKg} kg`]);
  if (vital.temperatureC !== null) values.push(['Temperatura', `${vital.temperatureC} °C`]);
  if (vital.heartRateBpm !== null)
    values.push(['Frecuencia cardiaca', `${vital.heartRateBpm} lpm`]);
  if (vital.respiratoryRateBpm !== null)
    values.push(['Frecuencia respiratoria', `${vital.respiratoryRateBpm} rpm`]);
  if (present(vital.bodyCondition)) values.push(['Condición corporal', vital.bodyCondition]);
  if (present(vital.hydration)) values.push(['Hidratación', vital.hydration]);
  if (present(vital.mucousMembranes)) values.push(['Mucosas', vital.mucousMembranes]);
  if (present(vital.skinTurgor)) values.push(['Turgencia cutánea', vital.skinTurgor]);
  if (present(vital.observations)) values.push(['Observaciones', vital.observations]);
  return values;
}

export function evolutionHasContent(evolution: ClinicalEvolutionResponse): boolean {
  return [evolution.subjective, evolution.objective, evolution.assessment, evolution.plan].some(
    present,
  );
}
