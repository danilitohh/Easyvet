import type {
  ClinicalEncounterListResponse,
  ClinicalEncounterResponse,
  ClinicalVitalResponse,
} from '@veterinary-saas/contracts';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicalEncounterDetailPage } from './ClinicalEncounterDetailPage';
import { ClinicalHistoryPage } from './ClinicalHistoryPage';

const ids = {
  patient: '11111111-1111-4111-8111-111111111111',
  encounter: '22222222-2222-4222-8222-222222222222',
  owner: '33333333-3333-4333-8333-333333333333',
  location: '44444444-4444-4444-8444-444444444444',
  record: '55555555-5555-4555-8555-555555555555',
};

const mocks = vi.hoisted(() => ({
  can: true,
  recordMissing: false,
  record: {
    id: '55555555-5555-4555-8555-555555555555',
    organizationId: '66666666-6666-4666-8666-666666666666',
    patientId: '11111111-1111-4111-8111-111111111111',
    createdAt: '2030-01-08T15:00:00.000Z',
    updatedAt: '2030-01-08T15:00:00.000Z',
    encounterCount: 1,
  },
  patient: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Luna',
    species: 'Canino',
    breed: 'Criollo',
    sex: 'FEMALE',
    birthDate: null,
    birthDateEstimated: false,
    color: null,
    microchipNumber: null,
    currentWeightKg: 20,
    sterilized: false,
    notes: null,
    ownerId: '33333333-3333-4333-8333-333333333333',
    status: 'ARCHIVED',
    archivedAt: null,
    createdAt: '2030-01-01T00:00:00.000Z',
    updatedAt: '2030-01-01T00:00:00.000Z',
    owner: { id: '33333333-3333-4333-8333-333333333333', firstName: 'Camila', lastName: 'Rojas' },
  },
  encounters: {
    data: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  } as ClinicalEncounterListResponse,
  evolutions: { data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } },
  vitals: [] as ClinicalVitalResponse[],
  encounter: null as ClinicalEncounterResponse | null,
}));

vi.mock('../../auth/useCan', () => ({ useCan: () => mocks.can }));
vi.mock('../patients/usePatients', () => ({
  usePatient: () => ({
    data: mocks.patient,
    patient: mocks.patient,
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
  useClinicalRecord: () => ({
    data: { clinicalRecord: mocks.recordMissing ? null : mocks.record },
    record: mocks.recordMissing ? null : mocks.record,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalEncounters: () => ({
    data: mocks.encounters,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalEvolutions: () => ({
    data: mocks.evolutions,
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
  useClinicalVitals: () => ({
    data: { data: mocks.vitals },
    vitals: mocks.vitals,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useProfessionalProfile: () => ({
    data: { membershipId: ids.owner, displayName: 'Dr. Vega', licenseNumber: null },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={[`/pacientes/${ids.patient}/historia`]}>
      <Routes>
        <Route path="/pacientes/:patientId/historia" element={<ClinicalHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

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

const baseEncounter = {
  id: ids.encounter,
  organizationId: '66666666-6666-4666-8666-666666666666',
  clinicalRecordId: ids.record,
  patientId: ids.patient,
  ownerIdAtTime: ids.owner,
  clinicLocationId: ids.location,
  appointmentId: null,
  responsibleMembershipId: null,
  status: 'FINALIZED',
  version: 1,
  reason: 'Consulta preventiva',
  anamnesis: 'Texto largo seguro <script>alert(1)</script>',
  physicalExam: null,
  presumptiveDiagnosis: null,
  differentialDiagnosis: null,
  definitiveDiagnosis: 'Paciente estable',
  diagnosticPlan: null,
  therapeuticPlan: null,
  recommendations: 'Continuar observación',
  followUpPlan: null,
  notes: null,
  professionalDisplayNameSnapshot: 'Dra. Vega',
  professionalLicenseSnapshot: 'MV-123',
  finalizedAt: '2030-01-08T16:00:00.000Z',
  finalizedByMembershipId: null,
  voidedAt: null,
  voidedByMembershipId: null,
  voidReason: null,
  occurredAt: '2030-01-08T15:00:00.000Z',
  createdByMembershipId: ids.owner,
  createdAt: '2030-01-08T15:00:00.000Z',
  updatedAt: '2030-01-08T16:00:00.000Z',
  patient: {
    id: ids.patient,
    name: 'Luna',
    species: 'Canino',
    status: 'ARCHIVED',
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
  responsibleProfessional: null,
  appointment: null,
} as ClinicalEncounterResponse;

describe('clinical read-only pages', () => {
  beforeEach(() => {
    mocks.can = true;
    mocks.recordMissing = false;
    mocks.encounters = { data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    mocks.evolutions = {
      data: [],
      pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    };
    mocks.vitals = [];
    mocks.encounter = null;
  });

  it('renders archived patient context and the clinical empty timeline', () => {
    renderHistory();
    expect(screen.getByText('Luna')).toBeInTheDocument();
    expect(screen.getByText('Archivado')).toBeInTheDocument();
    expect(screen.getByText('No hay encuentros clínicos')).toBeInTheDocument();
  });

  it('renders the no-record state without a create action', () => {
    mocks.recordMissing = true;
    renderHistory();
    expect(
      screen.getByText('Este paciente todavía no tiene historia clínica.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear/i })).not.toBeInTheDocument();
  });

  it('renders newest encounter status and historical owner snapshot', () => {
    mocks.encounters = {
      data: [baseEncounter],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
    renderHistory();
    expect(screen.getByText('Finalizado')).toBeInTheDocument();
    expect(screen.getByText(/Propietario histórico: Camila Rojas/)).toBeInTheDocument();
  });

  it('renders finalized detail, escaped long text and archived status', () => {
    mocks.encounter = baseEncounter;
    renderDetail();
    expect(screen.getAllByText('Finalizado').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Camila Rojas')).toBeInTheDocument();
    expect(screen.getByText(/Texto largo seguro/)).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
  });

  it('renders void warning and preserves visible history', () => {
    mocks.encounter = { ...baseEncounter, status: 'VOIDED', voidReason: 'Duplicado' };
    renderDetail();
    expect(screen.getAllByText('Anulado').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Este encuentro fue anulado/)).toBeInTheDocument();
    expect(screen.getByText('Duplicado')).toBeInTheDocument();
  });

  it('renders only populated vitals with clinical units', () => {
    mocks.encounter = baseEncounter;
    mocks.vitals = [
      {
        id: '77777777-7777-4777-8777-777777777777',
        measuredAt: '2030-01-08T15:00:00.000Z',
        weightKg: 20,
        temperatureC: null,
        heartRateBpm: 80,
        respiratoryRateBpm: null,
        bodyCondition: null,
        hydration: null,
        mucousMembranes: null,
        skinTurgor: null,
        observations: null,
      } as ClinicalVitalResponse,
    ];
    renderDetail();
    expect(screen.getAllByText('20 kg').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('80 lpm')).toBeInTheDocument();
    expect(screen.queryByText(/°C/)).not.toBeInTheDocument();
    expect(screen.getByText(/peso de esta medición es histórico/i)).toBeInTheDocument();
  });
});
