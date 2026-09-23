import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ClinicalFollowUpDashboard,
  ClinicalFollowUpDetail,
  ClinicalFollowUpListResponse,
} from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { FollowUpDashboardWidget } from './FollowUpDashboardWidget';
import { FollowUpDetailPage, FollowUpFormPage, FollowUpsPage } from './FollowUpsPages';

const ids = vi.hoisted(() => ({
  organization: '10000000-0000-4000-8000-000000000010',
  otherOrganization: '10000000-0000-4000-8000-000000000020',
  patient: '10000000-0000-4000-8000-000000000011',
  followUp: '10000000-0000-4000-8000-000000000013',
  membership: '10000000-0000-4000-8000-000000000014',
  encounter: '10000000-0000-4000-8000-000000000015',
}));

const mocks = vi.hoisted(() => ({
  organizationId: ids.organization,
  permissions: new Set<string>(),
  role: 'PRACTITIONER' as 'PRACTITIONER' | 'CLINICAL_ASSISTANT',
  list: null as ClinicalFollowUpListResponse | null,
  detail: null as ClinicalFollowUpDetail | null,
  dashboard: null as ClinicalFollowUpDashboard | null,
  dashboardLoading: false,
  dashboardError: null as unknown,
  dashboardReload: vi.fn(),
  patientStatus: 'ACTIVE' as 'ACTIVE' | 'ARCHIVED',
  listResource: { loading: false, error: null, reload: vi.fn(), data: null as unknown },
  detailResource: { loading: false, error: null, reload: vi.fn(), data: null as unknown },
  membersResource: { loading: false, error: null, reload: vi.fn(), data: { data: [] } as unknown },
  encountersResource: {
    loading: false,
    error: null,
    reload: vi.fn(),
    data: { data: [] } as unknown,
  },
  complete: vi.fn(),
  voidFollowUp: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  listCalls: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions.has(permission),
}));
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ activeMembership: { id: ids.membership, clinicalRole: mocks.role } }),
}));
vi.mock('../shared/hooks', () => ({ useActiveOrganizationId: () => mocks.organizationId }));
vi.mock('../clinical/useClinical', () => ({
  useClinicalOrganization: () => ({
    data: { timezone: 'America/Bogota' },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('../patients/usePatients', () => ({
  usePatient: () => ({
    patient: { id: ids.patient, name: 'Luna', species: 'DOG', status: mocks.patientStatus },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('../shared/useClinicalDomainResource', () => ({
  useClinicalMutationGuard: () => ({ signal: () => undefined, isCurrent: () => true }),
  useFollowUpListResource: (...args: unknown[]) => {
    mocks.listCalls(...args);
    return mocks.listResource;
  },
  useFollowUpResource: () => mocks.detailResource,
  useFollowUpMembersResource: () => mocks.membersResource,
  useFollowUpEncounterOptions: () => mocks.encountersResource,
  useFollowUpDashboardResource: () => ({
    data: mocks.dashboard,
    loading: mocks.dashboardLoading,
    error: mocks.dashboardError,
    reload: mocks.dashboardReload,
  }),
}));
vi.mock('./followUpsApi', () => ({
  followUpsApi: {
    complete: mocks.complete,
    void: mocks.voidFollowUp,
    create: mocks.create,
    update: mocks.update,
    list: vi.fn(),
  },
}));

// A complete resource DTO makes tests exercise the same contract shape used by production API reads.
function detail(overrides: Partial<ClinicalFollowUpDetail> = {}): ClinicalFollowUpDetail {
  return {
    id: ids.followUp,
    organizationId: ids.organization,
    patientId: ids.patient,
    sourceClinicalEncounterId: null,
    status: 'OPEN',
    version: 3,
    title: 'Control preventivo',
    reason: 'Revisar evolución',
    dueOn: '2035-01-09',
    reminderAt: '2035-01-09T15:15:00.000Z',
    reminderDue: true,
    assignedMembershipId: ids.membership,
    createdByMembershipId: ids.membership,
    completedAt: null,
    completedByMembershipId: null,
    outcome: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    createdAt: '2035-01-01T12:00:00.000Z',
    updatedAt: '2035-01-01T12:00:00.000Z',
    patient: {
      id: ids.patient,
      name: 'Luna',
      species: 'DOG',
      status: 'ACTIVE',
      owner: { id: '10000000-0000-4000-8000-000000000016', displayName: 'Camila Rojas' },
    },
    sourceEncounter: null,
    assignedMember: {
      membershipId: ids.membership,
      displayName: 'Dra. Camila',
      clinicalRole: 'PRACTITIONER',
    },
    createdBy: { membershipId: ids.membership, displayName: 'Dra. Camila' },
    completedBy: null,
    notes: 'Nota segura como texto',
    completionNotes: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    voidedBy: null,
    ...overrides,
  };
}

// Router helpers preserve the real path params and query behavior without mounting the full application shell.
function renderPage(path: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/seguimientos" element={element} />
        <Route path="/seguimientos/:followUpId" element={element} />
        <Route path="/seguimientos/:followUpId/editar" element={element} />
        <Route path="/pacientes/:patientId/seguimientos/nuevo" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('follow-ups frontend', () => {
  beforeEach(() => {
    mocks.organizationId = ids.organization;
    mocks.permissions = new Set([
      PERMISSION.FOLLOW_UPS_READ,
      PERMISSION.FOLLOW_UPS_CREATE,
      PERMISSION.FOLLOW_UPS_UPDATE,
      PERMISSION.FOLLOW_UPS_COMPLETE,
      PERMISSION.FOLLOW_UPS_VOID,
    ]);
    mocks.role = 'PRACTITIONER';
    mocks.patientStatus = 'ACTIVE';
    mocks.dashboard = null;
    mocks.dashboardLoading = false;
    mocks.dashboardError = null;
    mocks.dashboardReload.mockClear();
    mocks.detail = detail();
    mocks.detailResource = { loading: false, error: null, reload: vi.fn(), data: mocks.detail };
    mocks.list = {
      data: [{ ...detail(), patient: detail().patient, notes: undefined } as never],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
    mocks.listResource = { loading: false, error: null, reload: vi.fn(), data: mocks.list };
    mocks.membersResource = { loading: false, error: null, reload: vi.fn(), data: { data: [] } };
    mocks.encountersResource = { loading: false, error: null, reload: vi.fn(), data: { data: [] } };
    mocks.complete.mockResolvedValue(detail({ status: 'COMPLETED', version: 4 }));
    mocks.voidFollowUp.mockResolvedValue(detail({ status: 'VOIDED', version: 4 }));
    mocks.create.mockResolvedValue(detail());
    mocks.update.mockResolvedValue(detail());
    mocks.listCalls.mockClear();
  });

  it('defaults the global queue to OPEN and exposes computed operational filters', () => {
    renderPage('/seguimientos', <FollowUpsPage />);
    expect(screen.getByRole('heading', { name: 'Seguimientos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Todos abiertos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/Recordatorio pendiente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Vencidos' }));
    expect(screen.getByRole('button', { name: 'Vencidos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(mocks.listCalls.mock.lastCall?.[0]).toMatchObject({ status: 'OPEN' });
  });

  it('renders dashboard follow-up counts and the next operational items', () => {
    mocks.dashboard = {
      timezone: 'America/Bogota',
      today: '2035-01-09',
      counts: { overdue: 2, today: 1, upcoming7Days: 3, remindersDue: 1 },
      nextItems: [detail() as never],
    };
    renderPage('/seguimientos', <FollowUpDashboardWidget />);
    expect(screen.getByRole('heading', { name: 'Seguimientos' })).toBeInTheDocument();
    expect(screen.getByText(/Vencidos/)).toHaveTextContent('2');
    expect(screen.getByText(/Próx\. 7 días/)).toHaveTextContent('3');
    expect(screen.getByText(/Recordatorios/)).toHaveTextContent('1');
    expect(screen.getByRole('link', { name: /Luna · Control preventivo/ })).toHaveAttribute(
      'href',
      `/seguimientos/${ids.followUp}`,
    );
  });

  it('shows a voided-source warning, blocks ordinary actions, and retains the void action', () => {
    mocks.detail = detail({
      sourceClinicalEncounterId: ids.encounter,
      sourceEncounter: {
        id: ids.encounter,
        status: 'VOIDED',
        reason: 'Consulta anulada',
        occurredAt: '2035-01-01T12:00:00.000Z',
      },
    });
    mocks.detailResource = { loading: false, error: null, reload: vi.fn(), data: mocks.detail };
    renderPage(`/seguimientos/${ids.followUp}`, <FollowUpDetailPage />);
    expect(screen.getByText(/La consulta clínica asociada fue anulada/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Completar seguimiento' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anular seguimiento' })).toBeInTheDocument();
  });

  it('requires a Practitioner and active Patient before showing completion controls', () => {
    mocks.role = 'CLINICAL_ASSISTANT';
    const view = renderPage(`/seguimientos/${ids.followUp}`, <FollowUpDetailPage />);
    expect(screen.queryByRole('button', { name: 'Completar seguimiento' })).not.toBeInTheDocument();
    view.unmount();
    mocks.patientStatus = 'ARCHIVED';
    mocks.detail = detail({ patient: { ...detail().patient, status: 'ARCHIVED' } });
    mocks.detailResource = { loading: false, error: null, reload: vi.fn(), data: mocks.detail };
    renderPage(`/seguimientos/${ids.followUp}`, <FollowUpDetailPage />);
    expect(screen.getByText(/El paciente está archivado/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
  });

  it('submits completion with the reviewed CAS version and refreshes the detail', async () => {
    const reload = vi.fn();
    mocks.detailResource = { loading: false, error: null, reload, data: detail() };
    renderPage(`/seguimientos/${ids.followUp}`, <FollowUpDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Completar seguimiento' }));
    fireEvent.change(screen.getByLabelText('Resultado *'), {
      target: { value: 'Paciente estable' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar finalización' }));
    await waitFor(() =>
      expect(mocks.complete).toHaveBeenCalledWith(
        ids.followUp,
        expect.objectContaining({ expectedVersion: 3, outcome: 'Paciente estable' }),
        undefined,
      ),
    );
    expect(reload).toHaveBeenCalled();
  });

  it('keeps dueOn as the exact civil-date string and clears local form data on tenant change', async () => {
    const { rerender } = renderPage(
      `/pacientes/${ids.patient}/seguimientos/nuevo`,
      <FollowUpFormPage mode="create" />,
    );
    const dueInput = screen.getByLabelText('Vence el *');
    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Control en fecha civil' },
    });
    fireEvent.change(dueInput, { target: { value: '2035-01-09' } });
    expect(dueInput).toHaveValue('2035-01-09');
    mocks.organizationId = ids.otherOrganization;
    rerender(
      <MemoryRouter initialEntries={[`/pacientes/${ids.patient}/seguimientos/nuevo`]}>
        <Routes>
          <Route
            path="/pacientes/:patientId/seguimientos/nuevo"
            element={<FollowUpFormPage mode="create" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('Título *')).toHaveValue(''));
    expect(screen.getByLabelText('Vence el *')).toHaveValue('');
  });

  it('converts an Organization-local reminder to an explicit instant and sends the civil date unchanged', async () => {
    renderPage(`/pacientes/${ids.patient}/seguimientos/nuevo`, <FollowUpFormPage mode="create" />);
    fireEvent.change(screen.getByLabelText('Título *'), {
      target: { value: 'Control preventivo' },
    });
    fireEvent.change(screen.getByLabelText('Vence el *'), { target: { value: '2035-01-09' } });
    fireEvent.change(screen.getByLabelText('Fecha del recordatorio'), {
      target: { value: '2035-01-09' },
    });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear seguimiento' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        ids.patient,
        expect.objectContaining({ dueOn: '2035-01-09', reminderAt: '2035-01-09T15:15:00Z' }),
        undefined,
      ),
    );
  });
});
