import { describe, expect, it } from 'vitest';
import type { ClinicalProcedureDetail, ClinicalProcedureSummary } from '@veterinary-saas/contracts';
import {
  emptyProcedureForm,
  procedureOwnerName,
  procedurePatientName,
  procedurePayload,
  procedureProfessionalName,
  validateProcedureTimestamp,
} from './procedureUtils';

describe('procedure form mapping', () => {
  it('converts an organization-local procedure time to an unambiguous UTC instant', () => {
    const form = {
      ...emptyProcedureForm(),
      performedDate: '2030-01-08',
      performedTime: '10:00',
    };

    expect(procedurePayload(form, 'America/Bogota').performedAt).toBe('2030-01-08T15:00:00Z');
    expect(validateProcedureTimestamp(form, 'America/Bogota')).toBeNull();
  });

  it('keeps draft timestamps optional but rejects partial or invalid values', () => {
    expect(
      validateProcedureTimestamp({ ...emptyProcedureForm(), performedDate: '2030-01-08' }, 'UTC'),
    ).toMatch(/fecha como la hora/);
    expect(
      validateProcedureTimestamp(
        { ...emptyProcedureForm(), performedDate: '2030-02-30', performedTime: '10:00' },
        'UTC',
      ),
    ).toMatch(/no son válidas/);
    expect(validateProcedureTimestamp(emptyProcedureForm(), 'America/Bogota')).toBeNull();
  });

  it('only includes SurgeryDetail for surgery drafts and clears it for procedures', () => {
    const surgery = procedurePayload(
      { ...emptyProcedureForm('SURGERY'), assistantId: 'assistant-1', surgicalArea: 'Abdomen' },
      'UTC',
    );
    const procedure = procedurePayload(
      { ...emptyProcedureForm('PROCEDURE'), assistantId: 'assistant-1', surgicalArea: 'Abdomen' },
      'UTC',
    );

    expect(surgery.surgeryDetail).toMatchObject({
      assistantMembershipId: 'assistant-1',
      surgicalArea: 'Abdomen',
    });
    expect(procedure.surgeryDetail).toBeNull();
  });
});

describe('procedure historical identity', () => {
  const finalized = {
    status: 'FINALIZED',
    patient: { name: 'Nombre actual' },
    patientNameSnapshot: 'Paciente al finalizar',
    ownerDisplayNameSnapshot: 'Propietaria histórica',
    professionalDisplayNameSnapshot: 'Dra. Histórica',
    responsiblePractitioner: { displayName: 'Profesional actual' },
  } as unknown as ClinicalProcedureSummary;

  it('uses immutable snapshots for terminal records instead of live identities', () => {
    expect(procedurePatientName(finalized)).toBe('Paciente al finalizar');
    expect(procedureOwnerName(finalized)).toBe('Propietaria histórica');
    expect(procedureProfessionalName(finalized)).toBe('Dra. Histórica');
  });

  it('renders SurgeryDetail source fields only when provided by a surgery detail', () => {
    const detail = {
      ...finalized,
      kind: 'SURGERY',
      surgeryDetail: { surgicalArea: 'Abdomen' },
    } as unknown as ClinicalProcedureDetail;

    expect(detail.kind).toBe('SURGERY');
    expect(detail.surgeryDetail?.surgicalArea).toBe('Abdomen');
  });
});
