import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { findUnnamedActions, findUnlabeledFormControls } from '../test/accessibility';
import { AnesthesiaFormPage } from './anesthesia/AnesthesiaFormPage';
import { ProcedureFormPage } from './procedures/ProcedureFormPage';

const mocks = vi.hoisted(() => ({
  organization: { timezone: 'America/Bogota' },
  encounter: {
    id: '77777777-7777-4777-8777-777777777777',
    patientId: '88888888-8888-4888-8888-888888888888',
    status: 'DRAFT',
    patient: { id: '88888888-8888-4888-8888-888888888888', status: 'ACTIVE' },
  },
  members: {
    data: [
      {
        membershipId: '99999999-9999-4999-8999-999999999999',
        displayName: 'Dra. QA',
        clinicalRole: 'PRACTITIONER',
        profileConfigured: true,
      },
    ],
    page: 1,
    pageSize: 50,
    total: 1,
  },
  procedureList: {
    data: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  },
  createProcedure: vi.fn(),
  createAnesthesia: vi.fn(),
}));

vi.mock('../auth/useCan', () => ({ useCan: () => true }));
vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({
    activeMembership: {
      id: '99999999-9999-4999-8999-999999999999',
      clinicalRole: 'PRACTITIONER',
      organization: { id: '66666666-6666-4666-8666-666666666666' },
    },
  }),
}));
vi.mock('../features/shared/hooks', () => ({
  useActiveOrganizationId: () => '66666666-6666-4666-8666-666666666666',
}));
vi.mock('./clinical/useClinical', () => ({
  useClinicalOrganization: () => ({
    data: mocks.organization,
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
  useClinicalMembers: () => ({
    data: mocks.members,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('./shared/useClinicalDomainResource', () => ({
  useProcedureResource: () => ({ data: null, loading: false, error: null, reload: vi.fn() }),
  useAnesthesiaResource: () => ({ data: null, loading: false, error: null, reload: vi.fn() }),
  useProcedureListResource: () => ({
    data: mocks.procedureList,
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
  useClinicalMutationGuard: () => ({ signal: () => undefined, isCurrent: () => true }),
}));
vi.mock('./procedures/proceduresApi', () => ({
  proceduresApi: { create: mocks.createProcedure, updateDraft: vi.fn(), findById: vi.fn() },
}));
vi.mock('./anesthesia/anesthesiaApi', () => ({
  anesthesiaApi: { create: mocks.createAnesthesia, updateDraft: vi.fn(), findById: vi.fn() },
}));

function renderProcedure() {
  return render(
    <MemoryRouter
      initialEntries={[
        '/pacientes/88888888-8888-4888-8888-888888888888/historia/encuentros/77777777-7777-4777-8777-777777777777/procedimientos/nuevo',
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId/procedimientos/nuevo"
          element={<ProcedureFormPage mode="create" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderAnesthesia() {
  return render(
    <MemoryRouter
      initialEntries={[
        '/pacientes/88888888-8888-4888-8888-888888888888/historia/encuentros/77777777-7777-4777-8777-777777777777/anestesias/nueva',
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId/anestesias/nueva"
          element={<AnesthesiaFormPage mode="create" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('procedure and anesthesia form accessibility', () => {
  it('keeps procedure and anesthesia create controls accessible', async () => {
    const procedureView = renderProcedure();
    await screen.findByLabelText('Tipo de registro *');
    expect(findUnlabeledFormControls(procedureView.container)).toEqual([]);
    expect(findUnnamedActions(procedureView.container)).toEqual([]);
    procedureView.unmount();

    const anesthesiaView = renderAnesthesia();
    await screen.findByLabelText('Inicio');
    expect(findUnlabeledFormControls(anesthesiaView.container)).toEqual([]);
    expect(findUnnamedActions(anesthesiaView.container)).toEqual([]);
  });
});
