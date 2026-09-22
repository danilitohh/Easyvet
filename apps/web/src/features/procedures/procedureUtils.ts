import type { ClinicalProcedureDetail, ClinicalProcedureSummary } from '@veterinary-saas/contracts';
import { civilFieldsFromInstant, instantFromCivil } from '../agenda/agendaUtils';

export const PROCEDURE_KIND_LABEL = { PROCEDURE: 'Procedimiento', SURGERY: 'Cirugía' } as const;
export const PROCEDURE_STATUS_LABEL = {
  DRAFT: 'Borrador',
  FINALIZED: 'Finalizado',
  VOIDED: 'Anulado',
} as const;
export type ProcedureFormState = {
  kind: 'PROCEDURE' | 'SURGERY';
  procedureName: string;
  performedDate: string;
  performedTime: string;
  indication: string;
  description: string;
  technique: string;
  findings: string;
  complications: string;
  recoveryNotes: string;
  postoperativePlan: string;
  notes: string;
  responsibleId: string;
  assistantId: string;
  surgicalArea: string;
  surgicalSide: string;
  bleedingNotes: string;
  closureNotes: string;
};

// Keep optional form inputs as strings; only the API boundary turns empty values into nulls.
export function emptyProcedureForm(
  kind: ProcedureFormState['kind'] = 'PROCEDURE',
): ProcedureFormState {
  return {
    kind,
    procedureName: '',
    performedDate: '',
    performedTime: '',
    indication: '',
    description: '',
    technique: '',
    findings: '',
    complications: '',
    recoveryNotes: '',
    postoperativePlan: '',
    notes: '',
    responsibleId: '',
    assistantId: '',
    surgicalArea: '',
    surgicalSide: '',
    bleedingNotes: '',
    closureNotes: '',
  };
}

export function procedureFormFromDetail(
  item: ClinicalProcedureDetail,
  timezone: string,
): ProcedureFormState {
  const local = item.performedAt
    ? civilFieldsFromInstant(item.performedAt, timezone)
    : { date: '', time: '' };
  return {
    kind: item.kind,
    procedureName: item.procedureName ?? '',
    performedDate: local.date,
    performedTime: local.time,
    indication: item.indication ?? '',
    description: item.description ?? '',
    technique: item.technique ?? '',
    findings: item.findings ?? '',
    complications: item.complications ?? '',
    recoveryNotes: item.recoveryNotes ?? '',
    postoperativePlan: item.postoperativePlan ?? '',
    notes: item.notes ?? '',
    responsibleId: item.responsiblePractitionerMembershipId ?? '',
    assistantId: item.surgeryDetail?.assistantMembershipId ?? '',
    surgicalArea: item.surgeryDetail?.surgicalArea ?? '',
    surgicalSide: item.surgeryDetail?.surgicalSide ?? '',
    bleedingNotes: item.surgeryDetail?.bleedingNotes ?? '',
    closureNotes: item.surgeryDetail?.closureNotes ?? '',
  };
}

export function procedurePayload(form: ProcedureFormState, timezone: string) {
  const performedAt =
    form.performedDate && form.performedTime
      ? instantFromCivil(form.performedDate, form.performedTime, timezone)
      : null;
  const nullable = (value: string) => value.trim() || null;
  return {
    kind: form.kind,
    procedureName: nullable(form.procedureName),
    performedAt,
    indication: nullable(form.indication),
    description: nullable(form.description),
    technique: nullable(form.technique),
    findings: nullable(form.findings),
    complications: nullable(form.complications),
    recoveryNotes: nullable(form.recoveryNotes),
    postoperativePlan: nullable(form.postoperativePlan),
    notes: nullable(form.notes),
    responsiblePractitionerMembershipId: form.responsibleId || null,
    surgeryDetail:
      form.kind === 'SURGERY'
        ? {
            assistantMembershipId: form.assistantId || null,
            surgicalArea: nullable(form.surgicalArea),
            surgicalSide: nullable(form.surgicalSide),
            bleedingNotes: nullable(form.bleedingNotes),
            closureNotes: nullable(form.closureNotes),
          }
        : null,
  };
}

// Drafts may omit the timestamp, but a partially entered or invalid instant must never be dropped silently.
export function validateProcedureTimestamp(
  form: ProcedureFormState,
  timezone: string,
): string | null {
  if (Boolean(form.performedDate) !== Boolean(form.performedTime)) {
    return 'Ingresa tanto la fecha como la hora del procedimiento, o deja ambos campos vacíos.';
  }
  if (!form.performedDate) return null;
  try {
    instantFromCivil(form.performedDate, form.performedTime, timezone);
    return null;
  } catch {
    return 'La fecha y hora del procedimiento no son válidas en la zona horaria de la organización.';
  }
}

export function procedurePatientName(
  item: ClinicalProcedureSummary | ClinicalProcedureDetail,
): string {
  return item.status === 'DRAFT'
    ? item.patient.name
    : item.patientNameSnapshot?.trim() || 'Snapshot de paciente no disponible';
}
export function procedureOwnerName(
  item: ClinicalProcedureSummary | ClinicalProcedureDetail,
): string {
  return item.status === 'DRAFT'
    ? 'No registrado'
    : item.ownerDisplayNameSnapshot?.trim() || 'Snapshot de propietario no disponible';
}
export function procedureProfessionalName(
  item: ClinicalProcedureSummary | ClinicalProcedureDetail,
): string {
  return item.status === 'DRAFT'
    ? item.responsiblePractitioner?.displayName?.trim() || 'Sin asignar'
    : item.professionalDisplayNameSnapshot?.trim() || 'Snapshot profesional no disponible';
}
