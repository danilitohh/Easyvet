import { describe, expect, it } from '@jest/globals';
import { hasPermissions, permissionsForRole } from './permissions';

describe('clinical permission foundation', () => {
  it('keeps clinical access independent from the organizational role', () => {
    expect(permissionsForRole('OWNER', null)).not.toContain('clinicalRecords.read');
    expect(permissionsForRole('OWNER', 'PRACTITIONER')).toContain('clinicalRecords.read');
  });

  it('grants the complete clinical matrix to practitioners', () => {
    const permissions = permissionsForRole('RECEPTION', 'PRACTITIONER');

    expect(permissions).toEqual(
      expect.arrayContaining([
        'clinicalRecords.read',
        'clinicalEncounters.read',
        'clinicalEncounters.create',
        'clinicalEncounters.updateDraft',
        'clinicalEncounters.finalize',
        'clinicalEncounters.void',
        'clinicalEvolutions.read',
        'clinicalEvolutions.create',
        'clinicalVitals.read',
        'clinicalVitals.create',
      ]),
    );
  });

  it('limits clinical assistants to draft and observation work', () => {
    const permissions = permissionsForRole('ASSISTANT', 'CLINICAL_ASSISTANT');

    expect(permissions).toEqual(
      expect.arrayContaining([
        'clinicalRecords.read',
        'clinicalEncounters.read',
        'clinicalEncounters.create',
        'clinicalEncounters.updateDraft',
        'clinicalEvolutions.read',
        'clinicalVitals.read',
        'clinicalVitals.create',
      ]),
    );
    expect(permissions).not.toContain('clinicalEncounters.finalize');
    expect(permissions).not.toContain('clinicalEncounters.void');
    expect(permissions).not.toContain('clinicalEvolutions.create');
  });

  it('limits hospitalization operations by clinical role', () => {
    const practitioner = permissionsForRole('RECEPTION', 'PRACTITIONER');
    const assistant = permissionsForRole('ASSISTANT', 'CLINICAL_ASSISTANT');

    expect(practitioner).toEqual(
      expect.arrayContaining([
        'hospitalizations.read',
        'hospitalizations.create',
        'hospitalizations.update',
        'hospitalizations.activate',
        'hospitalizations.discharge',
        'hospitalizations.void',
        'hospitalizations.entries.create',
      ]),
    );
    expect(assistant).toEqual(
      expect.arrayContaining([
        'hospitalizations.read',
        'hospitalizations.create',
        'hospitalizations.update',
        'hospitalizations.entries.create',
      ]),
    );
    expect(assistant).not.toContain('hospitalizations.activate');
    expect(assistant).not.toContain('hospitalizations.discharge');
    expect(assistant).not.toContain('hospitalizations.void');
  });

  it('resolves required permissions from both role dimensions', () => {
    expect(hasPermissions('OWNER', null, ['clinicalEncounters.finalize'])).toBe(false);
    expect(hasPermissions('OWNER', 'PRACTITIONER', ['clinicalEncounters.finalize'])).toBe(true);
    expect(hasPermissions('ASSISTANT', 'CLINICAL_ASSISTANT', ['clinicalEvolutions.create'])).toBe(
      false,
    );
  });

  it('grants diagnostics lifecycle permissions by clinical role only', () => {
    const practitioner = permissionsForRole('OWNER', 'PRACTITIONER');
    const assistant = permissionsForRole('ASSISTANT', 'CLINICAL_ASSISTANT');
    const nonClinical = permissionsForRole('ADMIN', null);

    expect(practitioner).toEqual(
      expect.arrayContaining([
        'diagnostics.read',
        'diagnostics.create',
        'diagnostics.updateDraft',
        'diagnostics.request',
        'diagnostics.result',
        'diagnostics.void',
      ]),
    );
    expect(assistant).toEqual(
      expect.arrayContaining(['diagnostics.read', 'diagnostics.create', 'diagnostics.updateDraft']),
    );
    expect(assistant).not.toContain('diagnostics.request');
    expect(assistant).not.toContain('diagnostics.result');
    expect(assistant).not.toContain('diagnostics.void');
    expect(nonClinical).not.toContain('diagnostics.read');
  });

  it('grants document and consent workflows by clinical role without assistant issue or void authority', () => {
    const practitioner = permissionsForRole('RECEPTION', 'PRACTITIONER');
    const assistant = permissionsForRole('ASSISTANT', 'CLINICAL_ASSISTANT');
    const nonClinical = permissionsForRole('ADMIN', null);

    expect(practitioner).toEqual(
      expect.arrayContaining([
        'documents.read',
        'documents.generate',
        'documents.upload',
        'documents.void',
        'consents.read',
        'consents.create',
        'consents.updateDraft',
        'consents.issue',
        'consents.void',
      ]),
    );
    expect(assistant).toEqual(
      expect.arrayContaining([
        'documents.read',
        'documents.generate',
        'documents.upload',
        'consents.read',
        'consents.create',
        'consents.updateDraft',
      ]),
    );
    expect(assistant).not.toContain('documents.void');
    expect(assistant).not.toContain('consents.issue');
    expect(assistant).not.toContain('consents.void');
    expect(nonClinical).not.toContain('documents.read');
    expect(nonClinical).not.toContain('consents.read');
  });
});
