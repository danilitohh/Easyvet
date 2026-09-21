import type { ClinicalEncounterResponse } from '@veterinary-saas/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSION } from '../../auth/permissions';
import { ClinicalEncounterDetailPage } from './ClinicalEncounterDetailPage';
import { ClinicalEvolutionFormPage } from './ClinicalEvolutionFormPage';

const ids = vi.hoisted(() => ({
  patient: '11111111-1111-4111-8111-111111111111',
  encounter: '22222222-2222-4222-8222-222222222222',
  record: '33333333-3333-4333-8333-333333333333',
  owner: '44444444-4444-4444-8444-444444444444',
  location: '55555555-5555-4555-8555-555555555555',
  membership: '66666666-6666-4666-8666-666666666666',
}));

const mocks = vi.hoisted(() => ({
  permissions: {} as Record<string, boolean>,
  activeMembership: { id: ids.membership, clinicalRole: 'PRACTITIONER' },
  encounter: null as ClinicalEncounterResponse | null,
  finalizeEncounter: vi.fn(),
  voidEncounter: vi.fn(),
  createEvolution: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions[permission] ?? false,
}));
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ activeMembership: mocks.activeMembership }),
}));
vi.mock('../patients/usePatients', () => ({
  usePatient: () => ({
    patient: mocks.encounter?.patient ?? null,
    data: mocks.encounter?.patient ?? null,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('./useClinical', () => ({
  useClinicalOrganization: () => ({
    data: { timezone: 'America/Bogota' },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalEncounter: () => ({
    data: mocks.encounter,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalRecord: () => ({
    data: { clinicalRecord: { id: ids.record } },
    record: { id: ids.record },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalVitals: () => ({
    data: { data: [] },
    vitals: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalEvolutions: () => ({
    data: { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useProfessionalProfile: () => ({
    data: { membershipId: ids.membership, displayName: 'Dra. Demo', licenseNumber: 'LIC-123' },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('./clinicalApi', () => ({
  clinicalApi: {
    finalizeEncounter: mocks.finalizeEncounter,
    voidEncounter: mocks.voidEncounter,
    createEvolution: mocks.createEvolution,
  },
}));

const baseEncounter = {
  id: ids.encounter,
  organizationId: '77777777-7777-4777-8777-777777777777',
  clinicalRecordId: ids.record,
  patientId: ids.patient,
  ownerIdAtTime: ids.owner,
  clinicLocationId: ids.location,
  appointmentId: null,
  responsibleMembershipId: ids.membership,
  status: 'DRAFT',
  version: 3,
  reason: 'Consulta QA',
  anamnesis: 'Anamnesis',
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
    name: 'Luna',
    species: 'Canino',
    status: 'ACTIVE',
    ownerId: ids.owner,
  },
  historicalOwner: {
    id: ids.owner,
    firstName: 'Camila',
    lastName: 'Rojas',
    email: null,
    phone: null,
    status: 'ACTIVE',
  },
  clinicLocation: { id: ids.location, name: 'Norte', status: 'ACTIVE', address: null, city: null },
  responsibleProfessional: {
    membershipId: ids.membership,
    displayName: 'Dra. Demo',
    licenseNumber: 'LIC-123',
    role: 'VETERINARIAN',
    clinicalRole: 'PRACTITIONER',
  },
  appointment: null,
} as ClinicalEncounterResponse;

function renderDetail() {
  return render(
    <MemoryRouter
      initialEntries={[`/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}`]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId"
          element={<ClinicalEncounterDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEvolution(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/evoluciones/nueva"
          element={<ClinicalEvolutionFormPage />}
        />
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId/evoluciones/nueva"
          element={<ClinicalEvolutionFormPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('clinical finalize, evolution and void operations', () => {
  beforeEach(() => {
    mocks.encounter = { ...baseEncounter };
    mocks.activeMembership = { id: ids.membership, clinicalRole: 'PRACTITIONER' };
    mocks.permissions = {
      [PERMISSION.CLINICAL_ENCOUNTERS_READ]: true,
      [PERMISSION.CLINICAL_ENCOUNTERS_UPDATE_DRAFT]: true,
      [PERMISSION.CLINICAL_ENCOUNTERS_FINALIZE]: true,
      [PERMISSION.CLINICAL_ENCOUNTERS_VOID]: true,
      [PERMISSION.CLINICAL_VITALS_READ]: true,
      [PERMISSION.CLINICAL_VITALS_CREATE]: true,
      [PERMISSION.CLINICAL_EVOLUTIONS_READ]: true,
      [PERMISSION.CLINICAL_EVOLUTIONS_CREATE]: true,
    };
    mocks.finalizeEncounter
      .mockReset()
      .mockResolvedValue({ ...baseEncounter, status: 'FINALIZED' });
    mocks.voidEncounter.mockReset().mockResolvedValue({ ...baseEncounter, status: 'VOIDED' });
    mocks.createEvolution.mockReset().mockResolvedValue({});
  });

  it('shows finalize only to the responsible practitioner and sends expectedVersion', async () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar consulta' }));
    expect(
      screen.getByText('Al finalizar, esta consulta dejará de ser editable.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Finalizar consulta' })[1]!);
    await waitFor(() =>
      expect(mocks.finalizeEncounter).toHaveBeenCalledWith(ids.encounter, { expectedVersion: 3 }),
    );
  });

  it('does not show finalize to another practitioner and explains authorship', () => {
    mocks.activeMembership = {
      id: '88888888-8888-4888-8888-888888888888',
      clinicalRole: 'PRACTITIONER',
    };
    renderDetail();
    expect(screen.queryByRole('button', { name: 'Finalizar consulta' })).not.toBeInTheDocument();
    expect(screen.getByText(/debe ser finalizada por Dra\. Demo/)).toBeInTheDocument();
  });

  it('does not show finalize to an assistant', () => {
    mocks.permissions[PERMISSION.CLINICAL_ENCOUNTERS_FINALIZE] = false;
    mocks.activeMembership = {
      id: '88888888-8888-4888-8888-888888888888',
      clinicalRole: 'CLINICAL_ASSISTANT',
    };
    renderDetail();
    expect(screen.queryByRole('button', { name: 'Finalizar consulta' })).not.toBeInTheDocument();
  });

  it('shows profile warning and blocks finalize when the responsible profile is missing', () => {
    mocks.encounter = {
      ...baseEncounter,
      responsibleProfessional: { ...baseEncounter.responsibleProfessional!, displayName: null },
    };
    renderDetail();
    expect(
      screen.getByText(/Completa tu perfil profesional antes de finalizar/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizar consulta' })).not.toBeInTheDocument();
  });

  it('renders void only for finalized encounters and requires a reason', () => {
    mocks.encounter = {
      ...baseEncounter,
      status: 'FINALIZED',
      professionalDisplayNameSnapshot: 'Dra. Demo',
      professionalLicenseSnapshot: 'LIC-123',
      finalizedAt: '2030-01-08T16:00:00.000Z',
    };
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Anular consulta' }));
    expect(screen.getByText(/seguirá conservada en la historia clínica/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar anulación' })).toBeDisabled();
  });

  it('sends void reason and expectedVersion', async () => {
    mocks.encounter = { ...baseEncounter, status: 'FINALIZED' };
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Anular consulta' }));
    fireEvent.change(screen.getByLabelText('Motivo de anulación *'), {
      target: { value: 'Duplicado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await waitFor(() =>
      expect(mocks.voidEncounter).toHaveBeenCalledWith(ids.encounter, {
        expectedVersion: 3,
        reason: 'Duplicado',
      }),
    );
  });

  it('shows evolution action only for finalized encounters', () => {
    const first = renderDetail();
    expect(screen.queryByRole('link', { name: 'Agregar evolución' })).not.toBeInTheDocument();
    first.unmount();
    mocks.encounter = { ...baseEncounter, status: 'FINALIZED' };
    renderDetail();
    expect(screen.getByRole('link', { name: 'Agregar evolución' })).toBeInTheDocument();
  });

  it('keeps finalized encounters read-only and removes evolution action after voiding', () => {
    mocks.encounter = { ...baseEncounter, status: 'FINALIZED' };
    const finalized = renderDetail();
    expect(screen.queryByRole('link', { name: 'Editar borrador' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Añadir medición' })).not.toBeInTheDocument();
    finalized.unmount();
    mocks.encounter = { ...baseEncounter, status: 'VOIDED' };
    renderDetail();
    expect(screen.queryByRole('link', { name: 'Agregar evolución' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Estas mediciones pertenecen a una consulta anulada/),
    ).toBeInTheDocument();
  });

  it('submits an encounter-linked evolution without client-controlled authorship', async () => {
    mocks.encounter = { ...baseEncounter, status: 'FINALIZED' };
    renderEvolution(
      `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/evoluciones/nueva`,
    );
    fireEvent.change(screen.getByLabelText('Subjetivo'), { target: { value: 'Paciente estable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar evolución' }));
    await waitFor(() =>
      expect(mocks.createEvolution).toHaveBeenCalledWith(
        ids.patient,
        expect.objectContaining({
          clinicalEncounterId: ids.encounter,
          subjective: 'Paciente estable',
        }),
      ),
    );
  });

  it('blocks an empty evolution and submits a record-level evolution without author IDs', async () => {
    renderEvolution(`/pacientes/${ids.patient}/historia/evoluciones/nueva`);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar evolución' }));
    expect(await screen.findByText(/al menos un contenido clínico/)).toBeInTheDocument();
    expect(mocks.createEvolution).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Valoración'), { target: { value: 'Estable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar evolución' }));
    await waitFor(() =>
      expect(mocks.createEvolution).toHaveBeenCalledWith(
        ids.patient,
        expect.objectContaining({ clinicalEncounterId: null, assessment: 'Estable' }),
      ),
    );
  });
});
