import type { AnesthesiaObservation, AnesthesiaRecordDetail } from '@veterinary-saas/contracts';
import { civilFieldsFromInstant, instantFromCivil } from '../agenda/agendaUtils';

export type AnesthesiaFormState = {
  startedDate: string;
  startedTime: string;
  endedDate: string;
  endedTime: string;
  responsibleId: string;
  procedureId: string;
  asa: string;
  technique: string;
  assessment: string;
  medications: string;
  airway: string;
  fluids: string;
  complications: string;
  recovery: string;
  notes: string;
};
export type ObservationFormState = {
  observedDate: string;
  observedTime: string;
  heartRateBpm: string;
  respiratoryRatePerMinute: string;
  temperatureC: string;
  bloodPressureText: string;
  spo2Percent: string;
  etco2MmHg: string;
  anestheticPlane: string;
  notes: string;
};
export function emptyAnesthesiaForm(): AnesthesiaFormState {
  return {
    startedDate: '',
    startedTime: '',
    endedDate: '',
    endedTime: '',
    responsibleId: '',
    procedureId: '',
    asa: '',
    technique: '',
    assessment: '',
    medications: '',
    airway: '',
    fluids: '',
    complications: '',
    recovery: '',
    notes: '',
  };
}
export function anesthesiaFormFromDetail(
  item: AnesthesiaRecordDetail,
  timezone: string,
): AnesthesiaFormState {
  const started = item.startedAt
    ? civilFieldsFromInstant(item.startedAt, timezone)
    : { date: '', time: '' };
  const ended = item.endedAt
    ? civilFieldsFromInstant(item.endedAt, timezone)
    : { date: '', time: '' };
  return {
    startedDate: started.date,
    startedTime: started.time,
    endedDate: ended.date,
    endedTime: ended.time,
    responsibleId: item.responsiblePractitionerMembershipId ?? '',
    procedureId: item.clinicalProcedureId ?? '',
    asa: item.asaClassification ?? '',
    technique: item.technique ?? '',
    assessment: item.preAnestheticAssessment ?? '',
    medications: item.medicationsText ?? '',
    airway: item.airwayManagement ?? '',
    fluids: item.fluidsText ?? '',
    complications: item.complications ?? '',
    recovery: item.recoveryNotes ?? '',
    notes: item.notes ?? '',
  };
}
export function anesthesiaPayload(form: AnesthesiaFormState, timezone: string) {
  const nullable = (value: string) => value.trim() || null;
  return {
    startedAt:
      form.startedDate && form.startedTime
        ? instantFromCivil(form.startedDate, form.startedTime, timezone)
        : null,
    endedAt:
      form.endedDate && form.endedTime
        ? instantFromCivil(form.endedDate, form.endedTime, timezone)
        : null,
    responsiblePractitionerMembershipId: form.responsibleId || null,
    clinicalProcedureId: form.procedureId || null,
    asaClassification: nullable(form.asa),
    technique: nullable(form.technique),
    preAnestheticAssessment: nullable(form.assessment),
    medicationsText: nullable(form.medications),
    airwayManagement: nullable(form.airway),
    fluidsText: nullable(form.fluids),
    complications: nullable(form.complications),
    recoveryNotes: nullable(form.recovery),
    notes: nullable(form.notes),
  };
}

// Draft timestamps are optional but must be complete, valid local instants when either field is supplied.
export function validateAnesthesiaTimes(
  form: AnesthesiaFormState,
  timezone: string,
): string | null {
  for (const [label, date, time] of [
    ['inicio', form.startedDate, form.startedTime],
    ['finalización', form.endedDate, form.endedTime],
  ] as const) {
    if (Boolean(date) !== Boolean(time)) {
      return `Completa la fecha y la hora de ${label}, o deja ambos campos vacíos.`;
    }
    if (!date) continue;
    try {
      instantFromCivil(date, time, timezone);
    } catch {
      return `La fecha y hora de ${label} no son válidas en la zona horaria de la organización.`;
    }
  }
  if (form.startedDate && form.endedDate) {
    const startedAt = instantFromCivil(form.startedDate, form.startedTime, timezone);
    const endedAt = instantFromCivil(form.endedDate, form.endedTime, timezone);
    if (Date.parse(endedAt) < Date.parse(startedAt)) {
      return 'La hora de finalización debe ser igual o posterior al inicio.';
    }
  }
  return null;
}
export function emptyObservationForm(
  now = new Date().toISOString(),
  timezone = 'UTC',
): ObservationFormState {
  const local = civilFieldsFromInstant(now, timezone);
  return {
    observedDate: local.date,
    observedTime: local.time,
    heartRateBpm: '',
    respiratoryRatePerMinute: '',
    temperatureC: '',
    bloodPressureText: '',
    spo2Percent: '',
    etco2MmHg: '',
    anestheticPlane: '',
    notes: '',
  };
}
export function observationFormFromItem(
  item: AnesthesiaObservation,
  timezone: string,
): ObservationFormState {
  const local = civilFieldsFromInstant(item.observedAt, timezone);
  return {
    observedDate: local.date,
    observedTime: local.time,
    heartRateBpm: item.heartRateBpm === null ? '' : String(item.heartRateBpm),
    respiratoryRatePerMinute:
      item.respiratoryRatePerMinute === null ? '' : String(item.respiratoryRatePerMinute),
    temperatureC: item.temperatureC === null ? '' : String(item.temperatureC),
    bloodPressureText: item.bloodPressureText ?? '',
    spo2Percent: item.spo2Percent === null ? '' : String(item.spo2Percent),
    etco2MmHg: item.etco2MmHg === null ? '' : String(item.etco2MmHg),
    anestheticPlane: item.anestheticPlane ?? '',
    notes: item.notes ?? '',
  };
}
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));
export function observationPayload(form: ObservationFormState, timezone: string) {
  const nullable = (value: string) => value.trim() || null;
  return {
    observedAt: instantFromCivil(form.observedDate, form.observedTime, timezone),
    heartRateBpm: numberOrNull(form.heartRateBpm),
    respiratoryRatePerMinute: numberOrNull(form.respiratoryRatePerMinute),
    temperatureC: numberOrNull(form.temperatureC),
    bloodPressureText: nullable(form.bloodPressureText),
    spo2Percent: numberOrNull(form.spo2Percent),
    etco2MmHg: numberOrNull(form.etco2MmHg),
    anestheticPlane: nullable(form.anestheticPlane),
    notes: nullable(form.notes),
  };
}
export function observationHasClinicalValue(value: ReturnType<typeof observationPayload>): boolean {
  return (
    [
      value.heartRateBpm,
      value.respiratoryRatePerMinute,
      value.temperatureC,
      value.spo2Percent,
      value.etco2MmHg,
    ].some((field) => field !== null) ||
    [value.bloodPressureText, value.anestheticPlane, value.notes].some((field) => Boolean(field))
  );
}
export function anesthesiaPatientName(item: AnesthesiaRecordDetail): string {
  return item.status === 'DRAFT'
    ? item.patient.name
    : item.patientNameSnapshot?.trim() || 'Snapshot de paciente no disponible';
}
export function anesthesiaProfessionalName(item: AnesthesiaRecordDetail): string {
  return item.status === 'DRAFT'
    ? item.responsiblePractitioner?.displayName?.trim() || 'Sin asignar'
    : item.professionalDisplayNameSnapshot?.trim() || 'Snapshot profesional no disponible';
}
