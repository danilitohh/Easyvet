import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HospitalizationListPage } from './HospitalizationListPage';
import { defaultDischargeDateTime } from './hospitalizationDateUtils';

const mocks = vi.hoisted(() => ({ canRead: true, canCreate: true, resource: null as unknown }));

vi.mock('../../auth/useCan', () => ({ useCan: () => mocks.canRead }));
vi.mock('../clinical/useClinical', () => ({
  useClinicalOrganization: () => ({
    data: { timezone: 'America/Bogota' },
    loading: false,
    error: null,
  }),
}));
vi.mock('../shared/useClinicalDomainResource', () => ({
  useHospitalizationListResource: () => mocks.resource as never,
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
});
