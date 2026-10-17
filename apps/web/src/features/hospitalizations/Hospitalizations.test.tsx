import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HospitalizationFormPage } from './HospitalizationFormPage';
import { HospitalizationListPage } from './HospitalizationListPage';
import { defaultDischargeDateTime } from './hospitalizationDateUtils';
import { findUnnamedActions, findUnlabeledFormControls } from '../../test/accessibility';

const mocks = vi.hoisted(() => ({
  canRead: true,
  canCreate: true,
  resource: null as unknown,
  parentEncounter: null as unknown,
  hospitalizationResource: null as unknown,
  create: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) =>
    permission === 'hospitalizations.read' ? mocks.canRead : mocks.canCreate,
}));
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    activeMembership: {
      id: '55555555-5555-4555-8555-555555555555',
      organization: { id: '66666666-6666-4666-8666-666666666666' },
    },
  }),
}));
vi.mock('../clinical/useClinical', () => ({
  useClinicalOrganization: () => ({
    data: { timezone: 'America/Bogota' },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalEncounter: () => mocks.parentEncounter,
  useClinicalPractitioners: () => ({
    data: {
      data: [
        {
          membershipId: '55555555-5555-4555-8555-555555555555',
          displayName: 'Dra. QA',
          profileConfigured: true,
        },
      ],
      page: 1,
      pageSize: 50,
      total: 1,
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('../shared/useClinicalDomainResource', () => ({
  useHospitalizationListResource: () => mocks.resource as never,
  useHospitalizationResource: () => mocks.hospitalizationResource as never,
  useClinicalMutationGuard: () => ({ signal: () => undefined, isCurrent: () => true }),
}));
vi.mock('./hospitalizationsApi', () => ({
  hospitalizationsApi: { create: mocks.create, update: vi.fn() },
}));

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  clinicalEncounterId: '22222222-2222-4222-8222-222222222222',
  patientId: '33333333-3333-4333-8333-333333333333',
  status: 'ACTIVE',
  version: 2,
  admittedAt: '2035-01-08T15:00:00.000Z',
  dischargedAt: null,
  locationName: 'Norte',
  admissionReason: 'Observación',
  diagnosis: null,
  patientNameSnapshot: 'Luna',
  ownerDisplayNameSnapshot: 'Camila Rojas',
  professionalDisplayNameSnapshot: 'Dra. QA',
  professionalLicenseSnapshot: 'QA-1',
  createdAt: '2035-01-08T15:00:00.000Z',
  updatedAt: '2035-01-08T15:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/pacientes/' + base.patientId + '/historia/hospitalizaciones']}>
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/hospitalizaciones"
          element={<HospitalizationListPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderForm() {
  return render(
    <MemoryRouter
      initialEntries={[
        '/pacientes/' +
          base.patientId +
          '/historia/encuentros/' +
          base.clinicalEncounterId +
          '/hospitalizacion/nueva',
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId/hospitalizacion/nueva"
          element={<HospitalizationFormPage mode="create" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('hospitalization frontend', () => {
  beforeEach(() => {
    mocks.canRead = true;
    mocks.resource = {
      loading: false,
      error: null,
      data: {
        data: [
          base,
          {
            ...base,
            id: '44444444-4444-4444-8444-444444444444',
            status: 'DISCHARGED',
            admissionReason: null,
            diagnosis: 'Recuperación',
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
      },
      reload: vi.fn(),
    };
    mocks.parentEncounter = {
      loading: false,
      error: null,
      reload: vi.fn(),
      data: { id: base.clinicalEncounterId, status: 'DRAFT', patient: { status: 'ACTIVE' } },
    };
    mocks.hospitalizationResource = {
      loading: false,
      error: null,
      reload: vi.fn(),
      data: null,
    };
    mocks.create.mockReset();
  });

  it('renders lifecycle labels and semantic history links', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Hospitalizaciones' })).toBeInTheDocument();
    expect(screen.getByText('Hospitalizado')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Observación/ })).toHaveAttribute(
      'href',
      '/pacientes/' + base.patientId + '/historia/hospitalizaciones/' + base.id,
    );
  });

  it('does not expose history when the permission is absent', () => {
    mocks.canRead = false;
    renderPage();
    expect(screen.getByText('Acceso restringido')).toBeInTheDocument();
    expect(screen.queryByText('Hospitalizado')).not.toBeInTheDocument();
  });

  it('defaults discharge after a future admission', () => {
    expect(
      defaultDischargeDateTime(
        '2030-01-08T15:00:00.000Z',
        'America/Bogota',
        new Date('2026-09-22T17:00:00.000Z'),
      ),
    ).toBe('2030-01-08T10:00');
    expect(
      defaultDischargeDateTime(null, 'America/Bogota', new Date('2026-09-22T17:00:00.000Z')),
    ).toBe('2026-09-22T12:00');
  });

  it('keeps the hospitalization form controls accessible', () => {
    const view = renderForm();
    expect(findUnlabeledFormControls(view.container)).toEqual([]);
    expect(findUnnamedActions(view.container)).toEqual([]);
  });
});
