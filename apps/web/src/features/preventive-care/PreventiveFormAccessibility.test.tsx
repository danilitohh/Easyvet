import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findUnlabeledFormControls, findUnnamedActions } from '../../test/accessibility';
import { DewormingFormPage, VaccinationFormPage } from './PreventiveFormPage';

const ids = vi.hoisted(() => ({
  organization: '10000000-0000-4000-8000-000000000010',
  patient: '10000000-0000-4000-8000-000000000011',
  encounter: '10000000-0000-4000-8000-000000000012',
  membership: '10000000-0000-4000-8000-000000000013',
}));

const mocks = vi.hoisted(() => ({
  createVaccination: vi.fn(),
  createDeworming: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: () => true,
}));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    activeMembership: {
      id: ids.membership,
      clinicalRole: 'PRACTITIONER',
      organization: { id: ids.organization },
    },
  }),
}));

vi.mock('../shared/hooks', () => ({
  useActiveOrganizationId: () => ids.organization,
}));

vi.mock('../patients/usePatients', () => ({
  usePatient: () => ({
    patient: {
      id: ids.patient,
      name: 'Luna',
      status: 'ACTIVE',
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../clinical/useClinical', () => ({
  useClinicalOrganization: () => ({
    data: {
      id: ids.organization,
      name: 'Norte',
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalEncounter: () => ({
    data: {
      id: ids.encounter,
      patientId: ids.patient,
      status: 'DRAFT',
      reason: 'Consulta de control',
      occurredAt: '2035-01-08T15:00:00.000Z',
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalMembers: () => ({
    data: {
      data: [
        {
          membershipId: ids.membership,
          displayName: 'Dra. Camila',
          clinicalRole: 'PRACTITIONER',
          profileConfigured: true,
        },
      ],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('./useVaccinations', () => ({
  useVaccination: () => ({ data: null, loading: false, error: null, reload: vi.fn() }),
}));

vi.mock('./useDewormings', () => ({
  useDeworming: () => ({ data: null, loading: false, error: null, reload: vi.fn() }),
}));

vi.mock('./vaccinationsApi', () => ({
  vaccinationsApi: { create: mocks.createVaccination },
}));

vi.mock('./dewormingsApi', () => ({
  dewormingsApi: { create: mocks.createDeworming },
}));

function renderCreate(kind: 'vaccination' | 'deworming') {
  const suffix = kind === 'vaccination' ? 'vacunas' : 'desparasitaciones';
  return render(
    <MemoryRouter
      initialEntries={[
        `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/${suffix}/nueva`,
      ]}
    >
      <Routes>
        <Route
          path={`/pacientes/:patientId/historia/encuentros/:encounterId/vacunas/nueva`}
          element={<VaccinationFormPage mode="create" />}
        />
        <Route
          path={`/pacientes/:patientId/historia/encuentros/:encounterId/desparasitaciones/nueva`}
          element={<DewormingFormPage mode="create" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('preventive form accessibility', () => {
  beforeEach(() => {
    mocks.createVaccination.mockReset();
    mocks.createDeworming.mockReset();
  });

  it.each(['vaccination', 'deworming'] as const)(
    'keeps the %s form controls and actions accessible',
    async (kind) => {
      const view = renderCreate(kind);

      await screen.findByLabelText('Fecha de aplicación');

      expect(findUnlabeledFormControls(view.container)).toEqual([]);
      expect(findUnnamedActions(view.container)).toEqual([]);
    },
  );

  it('reports an invalid date sequence without creating a vaccination', async () => {
    renderCreate('vaccination');

    fireEvent.change(await screen.findByLabelText('Fecha de aplicación'), {
      target: { value: '2035-02-10' },
    });
    fireEvent.change(screen.getByLabelText('Próxima fecha'), {
      target: { value: '2035-02-09' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La próxima fecha debe ser igual o posterior a la fecha de aplicación.',
    );
    expect(mocks.createVaccination).not.toHaveBeenCalled();
  });
});
