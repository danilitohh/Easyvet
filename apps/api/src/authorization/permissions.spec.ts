import { describe, expect, it } from '@jest/globals';
import { hasPermissions, permissionsForRole } from './permissions';

describe('clinical permission foundation', () => {
  it('grants the commercial role matrix only to Owner, Admin, Cashier and Reception', () => {
    const full = [
      'sales.read',
      'sales.create',
      'sales.updateDraft',
      'sales.complete',
      'sales.void',
      'billing.read',
      'cash.read',
      'cash.open',
      'cash.movements',
      'cash.close',
    ];
    for (const role of ['OWNER', 'ADMIN'] as const) {
      expect(permissionsForRole(role)).toEqual(expect.arrayContaining(full));
    }
    const cashier = permissionsForRole('CASHIER');
    expect(cashier).toEqual(
      expect.arrayContaining(full.filter((permission) => permission !== 'sales.void')),
    );
    expect(cashier).not.toContain('sales.void');
    expect(permissionsForRole('RECEPTION')).toEqual(
      expect.arrayContaining([
        'sales.read',
        'sales.create',
        'sales.updateDraft',
        'sales.complete',
        'billing.read',
        'cash.read',
      ]),
    );
    expect(permissionsForRole('RECEPTION')).not.toEqual(
      expect.arrayContaining(['sales.void', 'cash.open', 'cash.movements', 'cash.close']),
    );
    expect(permissionsForRole('GROOMER')).not.toEqual(
      expect.arrayContaining(['sales.read', 'billing.read', 'cash.read']),
    );
    expect(permissionsForRole('VETERINARIAN', 'PRACTITIONER')).not.toContain('sales.read');
    expect(permissionsForRole('ASSISTANT', 'CLINICAL_ASSISTANT')).not.toContain('cash.read');
  });

  it('grants inventory mutations only to tenant administrators and read access to operational roles', () => {
    const adminPermissions = permissionsForRole('OWNER');
    const adminRolePermissions = permissionsForRole('ADMIN');
    const operationalRoles = [
      permissionsForRole('VETERINARIAN', 'PRACTITIONER'),
      permissionsForRole('ASSISTANT', 'CLINICAL_ASSISTANT'),
      permissionsForRole('RECEPTION'),
      permissionsForRole('GROOMER'),
      permissionsForRole('CASHIER'),
    ];
    const inventoryMutations = [
      'inventory.items.create',
      'inventory.items.update',
      'inventory.items.archive',
      'inventory.movements.create',
      'inventory.adjustments.create',
      'inventory.transfers.create',
    ];

    expect(adminPermissions).toEqual(
      expect.arrayContaining(['inventory.read', ...inventoryMutations]),
    );
    expect(adminRolePermissions).toEqual(
      expect.arrayContaining(['inventory.read', ...inventoryMutations]),
    );
    for (const permissions of operationalRoles) {
      expect(permissions).toContain('inventory.read');
      for (const mutation of inventoryMutations) expect(permissions).not.toContain(mutation);
    }
  });

  it('keeps grooming operational and grants only the documented role matrix', () => {
    const owner = permissionsForRole('OWNER');
    const receptionist = permissionsForRole('RECEPTION');
    const groomer = permissionsForRole('GROOMER');
    const veterinarian = permissionsForRole('VETERINARIAN', 'PRACTITIONER');
    const cashier = permissionsForRole('CASHIER');
    const assistant = permissionsForRole('ASSISTANT', 'CLINICAL_ASSISTANT');

    expect(owner).toEqual(
      expect.arrayContaining([
        'grooming.read',
        'grooming.create',
        'grooming.updateDraft',
        'grooming.perform',
        'grooming.complete',
        'grooming.void',
      ]),
    );
    expect(receptionist).toEqual(
      expect.arrayContaining(['grooming.read', 'grooming.create', 'grooming.updateDraft']),
    );
    expect(receptionist).not.toContain('grooming.perform');
    expect(groomer).toEqual(
      expect.arrayContaining([
        'grooming.read',
        'grooming.create',
        'grooming.updateDraft',
        'grooming.perform',
        'grooming.complete',
      ]),
    );
    expect(groomer).not.toContain('grooming.void');
    expect(veterinarian).toContain('grooming.read');
    expect(cashier).toContain('grooming.read');
    expect(assistant).not.toContain('grooming.read');
    expect(owner).not.toContain('clinicalRecords.read');
  });

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
