import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DiagnosticOrderDetail,
  DiagnosticOrderListResponse,
} from '@veterinary-saas/contracts';
import { ApiError } from '../../services/apiClient';
import { DiagnosticOrderDetailPage } from './DiagnosticOrderDetailPage';
import { DiagnosticOrderFormPage } from './DiagnosticOrderFormPage';
import { DiagnosticOrderListPage } from './DiagnosticOrderListPage';

const ids = vi.hoisted(() => ({
  organization: '10000000-0000-4000-8000-000000000010',
  patient: '10000000-0000-4000-8000-000000000011',
  encounter: '10000000-0000-4000-8000-000000000012',
  order: '10000000-0000-4000-8000-000000000013',
  membership: '10000000-0000-4000-8000-000000000014',
  otherMembership: '10000000-0000-4000-8000-000000000015',
}));

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  clinicalRole: 'PRACTITIONER' as 'PRACTITIONER' | 'CLINICAL_ASSISTANT',
  order: null as DiagnosticOrderDetail | null,
  list: null as DiagnosticOrderListResponse | null,
  resourceError: null as unknown,
  create: vi.fn(),
  updateDraft: vi.fn(),
  request: vi.fn(),
  result: vi.fn(),
  voidOrder: vi.fn(),
  reload: vi.fn(),
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
  useClinicalEncounter: () => ({
    data: {
      id: ids.encounter,
      patientId: ids.patient,
      status: 'DRAFT',
      patient: { id: ids.patient, name: 'Luna', status: 'ACTIVE' },
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
      ],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../shared/useClinicalDomainResource', () => ({
  useClinicalMutationGuard: () => ({ signal: () => undefined, isCurrent: () => true }),
  useDiagnosticOrderListResource: () => ({
    data: mocks.list,
    loading: false,
    error: mocks.resourceError,
    reload: mocks.reload,
  }),
  useDiagnosticOrderResource: () => ({
    data: mocks.order,
    loading: false,
    error: mocks.resourceError,
    reload: mocks.reload,
  }),
}));

vi.mock('./diagnosticsApi', () => ({
  diagnosticsApi: {
    create: mocks.create,
    updateDraft: mocks.updateDraft,
    request: mocks.request,
    result: mocks.result,
    void: mocks.voidOrder,
  },
}));

function order(overrides: Partial<DiagnosticOrderDetail> = {}): DiagnosticOrderDetail {
  return {
    id: ids.order,
    organizationId: ids.organization,
    clinicalEncounterId: ids.encounter,
    patientId: ids.patient,
    category: 'LABORATORY',
    status: 'DRAFT',
    version: 1,
    testName: 'Hemograma',
    requestedAt: '2035-01-08T15:00:00.000Z',
    reason: 'Control anual',
    instructions: null,
    notes: null,
    responsiblePractitionerMembershipId: ids.membership,
    createdByMembershipId: ids.membership,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    requestedByMembershipId: null,
    resultedAt: null,
    resultText: null,
    interpretation: null,
    resultedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    voidedByDisplayName: null,
    createdAt: '2035-01-08T15:00:00.000Z',
    updatedAt: '2035-01-08T15:00:00.000Z',
    parentEncounterStatus: 'DRAFT',
    patient: { id: ids.patient, name: 'Luna', status: 'ACTIVE' },
    encounter: {
      id: ids.encounter,
      status: 'DRAFT',
      occurredAt: '2035-01-08T15:00:00.000Z',
      reason: 'Consulta general',
    },
    responsiblePractitioner: {
      membershipId: ids.membership,
      displayName: 'Dra. Camila',
      licenseNumber: 'MV-1',
    },
    requestedBy: null,
    resultedBy: null,
    ...overrides,
  } satisfies DiagnosticOrderDetail;
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/pacientes/${ids.patient}/historia/diagnosticos/${ids.order}`]}>
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId"
          element={<DiagnosticOrderDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEditForm() {
  return render(
    <MemoryRouter
      initialEntries={[`/pacientes/${ids.patient}/historia/diagnosticos/${ids.order}/editar`]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId/editar"
          element={<DiagnosticOrderFormPage mode="edit" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderCreateForm() {
  return render(
    <MemoryRouter
      initialEntries={[
        `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/diagnosticos/nuevo`,
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId/diagnosticos/nuevo"
          element={<DiagnosticOrderFormPage mode="create" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('diagnostic orders frontend', () => {
  beforeEach(() => {
    ids.organization = '10000000-0000-4000-8000-000000000010';
    mocks.permissions = new Set([
      'diagnostics.read',
      'diagnostics.create',
      'diagnostics.updateDraft',
      'diagnostics.request',
      'diagnostics.result',
      'diagnostics.void',
    ]);
    mocks.clinicalRole = 'PRACTITIONER';
    mocks.order = order();
    mocks.list = {
      data: [order()],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
    mocks.resourceError = null;
    mocks.create.mockReset();
    mocks.updateDraft.mockReset();
    mocks.request.mockReset().mockResolvedValue(order({ status: 'REQUESTED', version: 2 }));
    mocks.result.mockReset().mockResolvedValue(order({ status: 'RESULTED', version: 3 }));
    mocks.voidOrder.mockReset();
    mocks.reload.mockReset();
  });

  it('shows lifecycle labels, category and a patient-scoped detail route', () => {
    render(
      <MemoryRouter initialEntries={[`/pacientes/${ids.patient}/historia/diagnosticos`]}>
        <Routes>
          <Route
            path="/pacientes/:patientId/historia/diagnosticos"
            element={<DiagnosticOrderListPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Diagnósticos y exámenes' })).toBeInTheDocument();
    expect(screen.getByText('Hemograma')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hemograma/ })).toHaveTextContent('Laboratorio');
    expect(screen.getByRole('link', { name: /Hemograma/ })).toHaveAttribute(
      'href',
      `/pacientes/${ids.patient}/historia/diagnosticos/${ids.order}`,
    );
  });

  it('requires Practitioner assignment to request, permits later result recording, and renders clinical text as text', async () => {
    const view = renderDetail();
    fireEvent.click(screen.getByRole('button', { name: 'Emitir solicitud' }));
    const requestDialog = screen.getByRole('dialog', { name: 'Emitir solicitud' });
    expect(requestDialog).toHaveTextContent('Luna');
    expect(requestDialog).toHaveTextContent('Hemograma');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar solicitud' }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith(ids.order, 1, undefined));

    mocks.order = order({
      status: 'REQUESTED',
      version: 2,
      requestedByMembershipId: ids.membership,
    });
    view.rerender(
      <MemoryRouter
        initialEntries={[`/pacientes/${ids.patient}/historia/diagnosticos/${ids.order}`]}
      >
        <Routes>
          <Route
            path="/pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId"
            element={<DiagnosticOrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }));
    fireEvent.change(screen.getByLabelText('Resultado'), {
      target: { value: '<script>alert(1)</script>\nLínea dos' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }));
    await waitFor(() => expect(mocks.result).toHaveBeenCalled());
    expect(mocks.result.mock.calls[0]?.[0]).toBe(ids.order);
    expect(mocks.result.mock.calls[0]?.[1]).toMatchObject({
      expectedVersion: 2,
      resultText: '<script>alert(1)</script>\nLínea dos',
      interpretation: null,
    });

    mocks.order = order({
      status: 'RESULTED',
      version: 3,
      resultedAt: '2035-01-09T15:00:00.000Z',
      resultText: '<script>alert(1)</script>\nLínea dos',
      resultedByMembershipId: ids.otherMembership,
      resultedBy: {
        membershipId: ids.otherMembership,
        displayName: 'Dr. Resultado',
        licenseNumber: null,
      },
      requestedBy: {
        membershipId: ids.membership,
        displayName: 'Dra. Camila',
        licenseNumber: 'MV-1',
      },
    });
    view.rerender(
      <MemoryRouter
        initialEntries={[`/pacientes/${ids.patient}/historia/diagnosticos/${ids.order}`]}
      >
        <Routes>
          <Route
            path="/pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId"
            element={<DiagnosticOrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/<script>alert\(1\)<\/script>/)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar resultado' })).not.toBeInTheDocument();
  });

  it('does not expose Practitioner lifecycle actions to a Clinical Assistant', () => {
    mocks.clinicalRole = 'CLINICAL_ASSISTANT';
    mocks.permissions = new Set([
      'diagnostics.read',
      'diagnostics.create',
      'diagnostics.updateDraft',
    ]);
    mocks.order = order({ status: 'REQUESTED', version: 2 });
    renderDetail();
    expect(screen.queryByRole('button', { name: 'Registrar resultado' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Anular evidencia' })).not.toBeInTheDocument();
  });

  it('warns on a voided parent and prevents draft editing', () => {
    mocks.order = order({ parentEncounterStatus: 'VOIDED', status: 'DRAFT' });
    renderDetail();
    expect(screen.getByRole('status')).toHaveTextContent('encuentro está anulado');
    expect(screen.queryByRole('link', { name: 'Editar borrador' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Emitir solicitud' })).not.toBeInTheDocument();
  });

  it('keeps local draft values after a stale response and scopes edit links to their patient', async () => {
    mocks.updateDraft.mockRejectedValueOnce(new ApiError('stale', 409, 'DIAGNOSTIC_ORDER_STALE'));
    renderEditForm();
    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'Edición local conservada' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(screen.getByText(/cambió en otra sesión/)).toBeInTheDocument());
    expect(screen.getByLabelText('Motivo')).toHaveValue('Edición local conservada');
  });

  it('clears unsaved diagnostic form values when the active organization changes', async () => {
    const view = renderCreateForm();
    fireEvent.change(screen.getByLabelText('Nombre del examen'), {
      target: { value: 'Datos que no deben cruzar de tenant' },
    });
    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'Borrador local pendiente' },
    });

    expect(screen.getByLabelText('Nombre del examen')).toHaveValue(
      'Datos que no deben cruzar de tenant',
    );
    ids.organization = '20000000-0000-4000-8000-000000000010';
    view.rerender(
      <MemoryRouter
        initialEntries={[
          `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}/diagnosticos/nuevo`,
        ]}
      >
        <Routes>
          <Route
            path="/pacientes/:patientId/historia/encuentros/:encounterId/diagnosticos/nuevo"
            element={<DiagnosticOrderFormPage mode="create" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByLabelText('Nombre del examen')).toHaveValue(''));
    expect(screen.getByLabelText('Motivo')).toHaveValue('');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('treats a detail deep link under a different patient as not found', () => {
    render(
      <MemoryRouter
        initialEntries={[
          `/pacientes/10000000-0000-4000-8000-000000000099/historia/diagnosticos/${ids.order}`,
        ]}
      >
        <Routes>
          <Route
            path="/pacientes/:patientId/historia/diagnosticos/:diagnosticOrderId"
            element={<DiagnosticOrderDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Recurso no encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Hemograma')).not.toBeInTheDocument();
  });
});
