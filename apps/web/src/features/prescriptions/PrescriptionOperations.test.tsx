import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrescriptionDetail } from '@veterinary-saas/contracts';
import { ApiError } from '../../services/apiClient';
import { PrescriptionDetailPage } from './PrescriptionDetailPage';
import { PrescriptionFormPage } from './PrescriptionFormPage';

const ids = vi.hoisted(() => ({
  organization: '10000000-0000-4000-8000-000000000010',
  patient: '10000000-0000-4000-8000-000000000011',
  encounter: '10000000-0000-4000-8000-000000000012',
  prescription: '10000000-0000-4000-8000-000000000013',
  membership: '10000000-0000-4000-8000-000000000014',
  otherMembership: '10000000-0000-4000-8000-000000000015',
}));

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  clinicalRole: 'PRACTITIONER' as 'PRACTITIONER' | 'ASSISTANT',
  create: vi.fn(),
  updateDraft: vi.fn(),
  finalize: vi.fn(),
  voidPrescription: vi.fn(),
  reloadPrescription: vi.fn(),
  prescription: null as PrescriptionDetail | null,
  encounterStatus: 'DRAFT' as 'DRAFT' | 'FINALIZED' | 'VOIDED',
  profile: { membershipId: ids.membership, displayName: 'Dra. Camila', licenseNumber: 'MV-1' },
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions.has(permission),
}));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    activeMembership: {
      id: ids.membership,
      clinicalRole: mocks.clinicalRole,
      organization: { id: ids.organization },
      permissions: [...mocks.permissions],
    },
  }),
}));

vi.mock('../shared/hooks', () => ({ useActiveOrganizationId: () => ids.organization }));

vi.mock('../clinical/useClinical', () => ({
  useClinicalOrganization: () => ({
    data: {
      id: ids.organization,
      name: 'Norte',
      slug: 'norte',
      status: 'ACTIVE',
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalPractitioners: () => ({
    data: {
      data: [
        {
          membershipId: ids.membership,
          displayName: 'Dra. Camila',
          profileConfigured: true,
          licenseNumber: 'MV-1',
          clinicalRole: 'PRACTITIONER',
        },
        {
          membershipId: ids.otherMembership,
          displayName: 'Dr. Otro',
          profileConfigured: false,
          licenseNumber: null,
          clinicalRole: 'PRACTITIONER',
        },
      ],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useProfessionalProfile: () => ({
    data: mocks.profile,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalEncounter: () => ({
    data: {
      id: ids.encounter,
      organizationId: ids.organization,
      clinicalRecordId: '10000000-0000-4000-8000-000000000016',
      patientId: ids.patient,
      ownerIdAtTime: '10000000-0000-4000-8000-000000000017',
      clinicLocationId: '10000000-0000-4000-8000-000000000018',
      appointmentId: null,
      responsibleMembershipId: ids.membership,
      status: mocks.encounterStatus,
      version: 1,
      reason: 'QA receta',
      anamnesis: null,
      physicalExam: null,
      presumptiveDiagnosis: null,
      differentialDiagnosis: null,
      definitiveDiagnosis: null,
      diagnosticPlan: null,
      therapeuticPlan: null,
      recommendations: null,
      followUpPlan: null,
      notes: null,
      professionalDisplayNameSnapshot: null,
      professionalLicenseSnapshot: null,
      finalizedAt: null,
      finalizedByMembershipId: null,
      voidedAt: null,
      voidedByMembershipId: null,
      voidReason: null,
      occurredAt: '2030-01-08T15:00:00.000Z',
      createdByMembershipId: ids.membership,
      createdAt: '2030-01-08T15:00:00.000Z',
      updatedAt: '2030-01-08T15:00:00.000Z',
      patient: {
        id: ids.patient,
        ownerId: '10000000-0000-4000-8000-000000000017',
        name: 'Luna',
        status: 'ACTIVE',
      },
      historicalOwner: {
        id: '10000000-0000-4000-8000-000000000017',
        firstName: 'Camila',
        lastName: 'Rojas',
        status: 'ACTIVE',
      },
      clinicLocation: {
        id: '10000000-0000-4000-8000-000000000018',
        name: 'Norte',
        status: 'ACTIVE',
        address: null,
        city: 'Bogotá',
      },
      responsibleProfessional: null,
      appointment: null,
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../patients/usePatients', () => ({
  usePatient: () => ({
    patient: {
      id: ids.patient,
      ownerId: '10000000-0000-4000-8000-000000000017',
      name: 'Luna',
      species: 'DOG',
      breed: 'Criollo',
      sex: 'FEMALE',
      birthDate: null,
      birthDateEstimated: false,
      color: null,
      microchipNumber: null,
      currentWeightKg: null,
      sterilized: false,
      notes: null,
      status: 'ACTIVE',
      archivedAt: null,
      createdAt: '2030-01-08T15:00:00.000Z',
      updatedAt: '2030-01-08T15:00:00.000Z',
      owner: {
        id: '10000000-0000-4000-8000-000000000017',
        firstName: 'Camila',
        lastName: 'Rojas',
        email: null,
        phone: null,
        documentType: null,
        documentNumber: null,
        status: 'ACTIVE',
      },
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('./prescriptionsApi', () => ({
  prescriptionsApi: {
    create: mocks.create,
    updateDraft: mocks.updateDraft,
    finalize: mocks.finalize,
    void: mocks.voidPrescription,
  },
}));

vi.mock('./usePrescriptions', () => ({
  usePrescription: () => ({
    data: mocks.prescription,
    loading: false,
    error: null,
    reload: mocks.reloadPrescription,
  }),
}));

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: '10000000-0000-4000-8000-000000000021',
    prescriptionId: ids.prescription,
    position: 0,
    medicationName: 'Amoxicilina',
    presentation: 'Suspensión',
    quantity: '1 frasco',
    dosage: '5 ml',
    frequency: 'Cada 12 horas',
    duration: '7 días',
    observations: 'Con alimento',
    createdAt: '2030-01-08T15:00:00.000Z',
    ...overrides,
  };
}

function prescription(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.prescription,
    organizationId: ids.organization,
    clinicalEncounterId: ids.encounter,
    patientId: ids.patient,
    status: 'DRAFT',
    itemCount: 1,
    version: 3,
    prescribedByMembershipId: ids.membership,
    createdByMembershipId: ids.membership,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    diagnosisSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    createdAt: '2030-01-08T15:00:00.000Z',
    updatedAt: '2030-01-08T15:00:00.000Z',
    parentEncounterStatus: 'DRAFT',
    patient: { id: ids.patient, name: 'Luna', status: 'ACTIVE' },
    prescribedBy: {
      membershipId: ids.membership,
      displayName: 'Dra. Camila',
      licenseNumber: 'MV-1',
    },
    items: [item()],
    ...overrides,
  } as PrescriptionDetail;
}

function renderCreate() {
  return render(
    <MemoryRouter
      initialEntries={[
        `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/prescripciones/nueva`,
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId/prescripciones/nueva"
          element={<PrescriptionFormPage mode="create" />}
        />
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId"
          element={<p>Detalle de encuentro</p>}
        />
        <Route path="*" element={<p>Destino</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEdit() {
  return render(
    <MemoryRouter
      initialEntries={[
        `/pacientes/${ids.patient}/historia/prescripciones/${ids.prescription}/editar`,
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/prescripciones/:prescriptionId/editar"
          element={<PrescriptionFormPage mode="edit" />}
        />
        <Route
          path="/pacientes/:patientId/historia/prescripciones/:prescriptionId"
          element={<p>Detalle de prescripción</p>}
        />
        <Route path="*" element={<p>Destino</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetail() {
  return render(
    <MemoryRouter
      initialEntries={[`/pacientes/${ids.patient}/historia/prescripciones/${ids.prescription}`]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/prescripciones/:prescriptionId"
          element={<PrescriptionDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.permissions = new Set([
    'prescriptions.read',
    'prescriptions.create',
    'prescriptions.updateDraft',
    'prescriptions.finalize',
    'prescriptions.void',
    'clinicalEncounters.read',
  ]);
  mocks.clinicalRole = 'PRACTITIONER';
  mocks.encounterStatus = 'DRAFT';
  mocks.profile = {
    membershipId: ids.membership,
    displayName: 'Dra. Camila',
    licenseNumber: 'MV-1',
  };
  mocks.prescription = null;
  mocks.create.mockReset().mockResolvedValue(prescription());
  mocks.updateDraft.mockReset().mockResolvedValue(prescription());
  mocks.finalize
    .mockReset()
    .mockResolvedValue(
      prescription({ status: 'FINALIZED', finalizedAt: '2030-01-08T16:00:00.000Z' }),
    );
  mocks.voidPrescription
    .mockReset()
    .mockResolvedValue(prescription({ status: 'VOIDED', voidReason: 'QA' }));
  mocks.reloadPrescription.mockReset();
});

describe('PrescriptionFormPage operations', () => {
  it('uses the contextual route and never asks for a second patient or encounter', async () => {
    renderCreate();
    expect(await screen.findByRole('heading', { name: 'Nueva prescripción' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Paciente|Consulta/)).not.toBeInTheDocument();
  });

  it('allows a draft with zero items and an unassigned prescriber', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: 'Nueva prescripción' });
    fireEvent.change(screen.getByLabelText('Profesional prescriptor'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        ids.encounter,
        expect.objectContaining({ prescribedByMembershipId: null, items: [] }),
        expect.anything(),
      ),
    );
  });

  it('preselects the current practitioner but not an assistant', async () => {
    renderCreate();
    expect(await screen.findByLabelText('Profesional prescriptor')).toHaveValue(ids.membership);
    cleanup();
    mocks.clinicalRole = 'ASSISTANT';
    const view = renderCreate();
    expect(await view.findByLabelText('Profesional prescriptor')).toHaveValue('');
  });

  it('blocks create when the parent encounter is voided', async () => {
    mocks.encounterStatus = 'VOIDED';
    renderCreate();
    expect(await screen.findByText(/consulta asociada fue anulada/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
  });

  it('allows creating from a finalized parent encounter without changing its context', async () => {
    mocks.encounterStatus = 'FINALIZED';
    renderCreate();
    expect(await screen.findByRole('heading', { name: 'Nueva prescripción' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'QA receta' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        ids.encounter,
        expect.anything(),
        expect.anything(),
      ),
    );
  });

  it('returns to the encounter when a create collides with a parent void', async () => {
    mocks.create.mockRejectedValue(new ApiError('voided', 409, 'PARENT_CLINICAL_ENCOUNTER_VOIDED'));
    renderCreate();
    await screen.findByRole('heading', { name: 'Nueva prescripción' });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByText('Detalle de encuentro')).toBeInTheDocument();
  });

  it('denies the create route without the dedicated create permission', async () => {
    mocks.permissions.delete('prescriptions.create');
    renderCreate();
    expect(await screen.findByText(/No tienes permisos para esta acción/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar borrador' })).not.toBeInTheDocument();
  });

  it('marks a selected practitioner with an incomplete profile before finalization', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: 'Nueva prescripción' });
    fireEvent.change(screen.getByLabelText('Profesional prescriptor'), {
      target: { value: ids.otherMembership },
    });
    expect(screen.getByText(/Perfil profesional incompleto/i)).toBeInTheDocument();
  });

  it('adds a free-text item and preserves multiline observations', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: 'Nueva prescripción' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar medicamento' }));
    fireEvent.change(screen.getByLabelText('Medicamento *'), { target: { value: 'Meloxicam' } });
    fireEvent.change(screen.getByLabelText('Observaciones'), {
      target: { value: 'Línea 1\nLínea 2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        ids.encounter,
        expect.objectContaining({
          items: [
            expect.objectContaining({
              medicationName: 'Meloxicam',
              observations: 'Línea 1\nLínea 2',
              position: 0,
            }),
          ],
        }),
        expect.anything(),
      ),
    );
  });

  it('validates medication name but accepts optional item fields as blank', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: 'Nueva prescripción' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar medicamento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /nombre del medicamento es obligatorio/i,
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('removes items and supports accessible up/down ordering', async () => {
    renderCreate();
    await screen.findByRole('heading', { name: 'Nueva prescripción' });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar medicamento' }));
    fireEvent.change(screen.getAllByLabelText('Medicamento *')[0]!, { target: { value: 'A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar medicamento' }));
    fireEvent.change(screen.getAllByLabelText('Medicamento *')[1]!, { target: { value: 'B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mover medicamento 2 arriba' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar medicamento 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        ids.encounter,
        expect.objectContaining({
          items: [expect.objectContaining({ medicationName: 'B', position: 0 })],
        }),
        expect.anything(),
      ),
    );
  });

  it('sends the complete normalized item set with no client snapshots', async () => {
    mocks.prescription = prescription();
    renderEdit();
    expect(await screen.findByDisplayValue('Amoxicilina')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Dosis'), { target: { value: '10 ml' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() =>
      expect(mocks.updateDraft).toHaveBeenCalledWith(
        ids.prescription,
        expect.objectContaining({
          expectedVersion: 3,
          items: [
            expect.objectContaining({
              medicationName: 'Amoxicilina',
              dosage: '10 ml',
              position: 0,
            }),
          ],
        }),
        expect.anything(),
      ),
    );
    expect(mocks.updateDraft.mock.calls[0]![1]).not.toHaveProperty(
      'professionalDisplayNameSnapshot',
    );
  });

  it('shows stale without overwriting local edits and provides an explicit reload', async () => {
    mocks.prescription = prescription();
    mocks.updateDraft.mockRejectedValue(new ApiError('stale', 409, 'PRESCRIPTION_STALE'));
    renderEdit();
    expect(await screen.findByDisplayValue('Amoxicilina')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Dosis'), { target: { value: 'local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/modificada desde otra sesión/i);
    expect(screen.getByLabelText('Dosis')).toHaveValue('local');
    fireEvent.click(screen.getByRole('button', { name: 'Recargar versión actual' }));
    expect(mocks.reloadPrescription).toHaveBeenCalled();
  });

  it('stops editing when the parent encounter is voided during save', async () => {
    mocks.prescription = prescription();
    mocks.updateDraft.mockRejectedValue(
      new ApiError('voided', 409, 'PARENT_CLINICAL_ENCOUNTER_VOIDED'),
    );
    renderEdit();
    expect(await screen.findByDisplayValue('Amoxicilina')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByText('Detalle de prescripción')).toBeInTheDocument();
  });
});

describe('PrescriptionDetailPage operations', () => {
  it('shows edit only for drafts with update permission', async () => {
    mocks.prescription = prescription();
    renderDetail();
    expect(await screen.findByRole('link', { name: 'Editar borrador' })).toBeInTheDocument();
    cleanup();
    mocks.permissions.delete('prescriptions.updateDraft');
    renderDetail();
    expect(screen.queryByRole('link', { name: 'Editar borrador' })).not.toBeInTheDocument();
  });

  it('does not expose finalize to an assistant or a different practitioner', async () => {
    mocks.prescription = prescription();
    mocks.clinicalRole = 'ASSISTANT';
    const assistantView = renderDetail();
    expect(
      await assistantView.findByText(/prescriptor actual|Prescriptor actual/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Finalizar prescripción' }),
    ).not.toBeInTheDocument();
    cleanup();
    mocks.clinicalRole = 'PRACTITIONER';
    mocks.prescription = prescription({
      prescribedByMembershipId: ids.otherMembership,
      prescribedBy: {
        membershipId: ids.otherMembership,
        displayName: 'Dr. Otro',
        licenseNumber: 'MV-2',
      },
    });
    renderDetail();
    expect(
      screen.queryByRole('button', { name: 'Finalizar prescripción' }),
    ).not.toBeInTheDocument();
    expect(await screen.findByText(/debe ser finalizada por Dr. Otro/i)).toBeInTheDocument();
  });

  it('blocks finalize when profile is incomplete or items are empty', async () => {
    mocks.prescription = prescription({ items: [] });
    mocks.profile = { membershipId: ids.membership, displayName: '', licenseNumber: '' };
    renderDetail();
    expect(await screen.findByText(/Completa tu perfil profesional/i)).toBeInTheDocument();
    expect(screen.getByText(/Agrega al menos un medicamento/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Finalizar prescripción' }),
    ).not.toBeInTheDocument();
  });

  it('opens a review modal with snapshots context before finalizing', async () => {
    mocks.prescription = prescription();
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar prescripción' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/Versión revisada.*3/s);
    expect(screen.getByRole('dialog')).toHaveTextContent(/dejará de ser editable/i);
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('finalizes with expectedVersion and refreshes only after success', async () => {
    mocks.prescription = prescription();
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar prescripción' }));
    fireEvent.click(screen.getByRole('dialog').querySelector('button.button--primary')!);
    await waitFor(() =>
      expect(mocks.finalize).toHaveBeenCalledWith(ids.prescription, { expectedVersion: 3 }),
    );
    expect(mocks.reloadPrescription).toHaveBeenCalled();
  });

  it('keeps review open on a stale finalize response and offers reload', async () => {
    mocks.prescription = prescription();
    mocks.finalize.mockRejectedValue(new ApiError('stale', 409, 'PRESCRIPTION_STALE'));
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Finalizar prescripción' }));
    fireEvent.click(screen.getByRole('dialog').querySelector('button.button--primary')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/modificada desde otra sesión/i);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recargar versión actual' }));
    expect(mocks.reloadPrescription).toHaveBeenCalled();
  });

  it('shows void only for finalized prescriptions and requires a reason', async () => {
    mocks.prescription = prescription({
      status: 'FINALIZED',
      finalizedAt: '2030-01-08T16:00:00.000Z',
    });
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Anular prescripción' }));
    expect(screen.getByRole('button', { name: 'Confirmar anulación' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo de anulación *'), {
      target: { value: 'QA cleanup' },
    });
    expect(screen.getByRole('button', { name: 'Confirmar anulación' })).toBeEnabled();
  });

  it('voids with reason and expectedVersion without deleting historical items', async () => {
    mocks.prescription = prescription({
      status: 'FINALIZED',
      finalizedAt: '2030-01-08T16:00:00.000Z',
    });
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Anular prescripción' }));
    fireEvent.change(screen.getByLabelText('Motivo de anulación *'), {
      target: { value: 'QA cleanup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await waitFor(() =>
      expect(mocks.voidPrescription).toHaveBeenCalledWith(ids.prescription, {
        expectedVersion: 3,
        reason: 'QA cleanup',
      }),
    );
    expect(mocks.reloadPrescription).toHaveBeenCalled();
  });

  it('preserves a finalized prescription when the parent encounter is voided', async () => {
    mocks.prescription = prescription({
      status: 'FINALIZED',
      parentEncounterStatus: 'VOIDED',
      finalizedAt: '2030-01-08T16:00:00.000Z',
    });
    renderDetail();
    expect(await screen.findByText(/conserva su estado histórico/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar borrador' })).not.toBeInTheDocument();
  });

  it('does not offer edit for finalized or voided status', async () => {
    mocks.prescription = prescription({ status: 'VOIDED', voidReason: 'No procede' });
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'Anulada' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar borrador' })).not.toBeInTheDocument();
  });

  it('renders item ordering and preserves multiline text in historical detail', async () => {
    mocks.prescription = prescription({
      items: [
        item({ position: 1, medicationName: 'B' }),
        item({
          id: '10000000-0000-4000-8000-000000000022',
          position: 0,
          medicationName: 'A',
          observations: 'uno\ndos',
        }),
      ],
    });
    renderDetail();
    expect(await screen.findByRole('heading', { name: 'A' })).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes('uno') && content.includes('dos')),
    ).toBeInTheDocument();
  });

  it('supports multiple prescriptions under the same encounter through the contextual create entry', async () => {
    mocks.prescription = null;
    renderCreate();
    expect(await screen.findByRole('heading', { name: 'Nueva prescripción' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
  });
});
