import { describe, expect, it } from 'vitest';
import type { AnesthesiaRecordDetail } from '@veterinary-saas/contracts';
import {
  anesthesiaPatientName,
  anesthesiaProfessionalName,
  emptyAnesthesiaForm,
  emptyObservationForm,
  observationHasClinicalValue,
  observationPayload,
  validateAnesthesiaTimes,
} from './anesthesiaUtils';

describe('anesthesia timestamps', () => {
  it('converts local start/end times in the organization timezone', () => {
    const form = {
      ...emptyAnesthesiaForm(),
      startedDate: '2030-01-08',
      startedTime: '10:00',
      endedDate: '2030-01-08',
      endedTime: '10:30',
    };

    expect(validateAnesthesiaTimes(form, 'America/Bogota')).toBeNull();
    expect(
      observationPayload(
        emptyObservationForm('2030-01-08T15:00:00.000Z', 'America/Bogota'),
        'America/Bogota',
      ).observedAt,
    ).toBe('2030-01-08T15:00:00Z');
  });

  it('rejects incomplete, invalid and reversed intervals while allowing an empty draft', () => {
    expect(
      validateAnesthesiaTimes(
        { ...emptyAnesthesiaForm(), startedDate: '2030-01-08' },
        'America/Bogota',
      ),
    ).toMatch(/fecha y la hora de inicio/);
    expect(
      validateAnesthesiaTimes(
        { ...emptyAnesthesiaForm(), startedDate: '2030-02-30', startedTime: '10:00' },
        'UTC',
      ),
    ).toMatch(/no son válidas/);
    expect(
      validateAnesthesiaTimes(
        {
          ...emptyAnesthesiaForm(),
          startedDate: '2030-01-08',
          startedTime: '10:30',
          endedDate: '2030-01-08',
          endedTime: '10:00',
        },
        'UTC',
      ),
    ).toMatch(/posterior al inicio/);
    expect(validateAnesthesiaTimes(emptyAnesthesiaForm(), 'UTC')).toBeNull();
  });
});

describe('anesthesia observation values', () => {
  it('preserves numeric zero and maps only empty inputs to null', () => {
    const payload = observationPayload(
      {
        ...emptyObservationForm('2030-01-08T15:00:00.000Z', 'America/Bogota'),
        heartRateBpm: '0',
        respiratoryRatePerMinute: '0',
        temperatureC: '',
        spo2Percent: '0',
        etco2MmHg: '0',
      },
      'America/Bogota',
    );

    expect(payload).toMatchObject({
      heartRateBpm: 0,
      respiratoryRatePerMinute: 0,
      temperatureC: null,
      spo2Percent: 0,
      etco2MmHg: 0,
    });
    expect(observationHasClinicalValue(payload)).toBe(true);
  });

  it('accepts note-only and plane-only observations but rejects empty clinical content', () => {
    const base = emptyObservationForm('2030-01-08T15:00:00.000Z', 'America/Bogota');
    expect(
      observationHasClinicalValue(
        observationPayload({ ...base, notes: 'Control clínico' }, 'America/Bogota'),
      ),
    ).toBe(true);
    expect(
      observationHasClinicalValue(
        observationPayload({ ...base, anestheticPlane: 'Ligero' }, 'America/Bogota'),
      ),
    ).toBe(true);
    expect(observationHasClinicalValue(observationPayload(base, 'America/Bogota'))).toBe(false);
  });
});

describe('anesthesia historical identity', () => {
  const finalized = {
    status: 'FINALIZED',
    patient: { name: 'Nombre actual' },
    patientNameSnapshot: 'Paciente al finalizar',
    professionalDisplayNameSnapshot: 'Dra. Histórica',
    responsiblePractitioner: { displayName: 'Profesional actual' },
  } as unknown as AnesthesiaRecordDetail;

  it('uses immutable snapshots for terminal records', () => {
    expect(anesthesiaPatientName(finalized)).toBe('Paciente al finalizar');
    expect(anesthesiaProfessionalName(finalized)).toBe('Dra. Histórica');
  });
});
