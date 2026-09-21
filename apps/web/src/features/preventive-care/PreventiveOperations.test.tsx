import type { DewormingDetail, VaccinationDetail } from '@veterinary-saas/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSION } from '../../auth/permissions';
import { ApiError } from '../../services/apiClient';
import { PreventiveDetailActions } from './PreventiveDetailActions';

const ids = vi.hoisted(() => ({
  patient: '11111111-1111-4111-8111-111111111111',
  encounter: '22222222-2222-4222-8222-222222222222',
  record: '33333333-3333-4333-8333-333333333333',
  practitioner: '44444444-4444-4444-8444-444444444444',
  assistant: '55555555-5555-4555-8555-555555555555',
}));
const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  role: 'PRACTITIONER' as string,
  finalize: vi.fn(),
  voidRecord: vi.fn(),
  reload: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions.has(permission),
}));
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    activeMembership: {
      id: ids.practitioner,
      clinicalRole: mocks.role,
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
}));
vi.mock('./vaccinationsApi', () => ({
  vaccinationsApi: { finalize: mocks.finalize, void: mocks.voidRecord },
}));
vi.mock('./dewormingsApi', () => ({
  dewormingsApi: { finalize: mocks.finalize, void: mocks.voidRecord },
}));

function vaccination(overrides: Partial<VaccinationDetail> = {}) {
  return {
    id: ids.record,
    organizationId: '66666666-6666-4666-8666-666666666666',
    clinicalEncounterId: ids.encounter,
    patientId: ids.patient,
    status: 'DRAFT' as const,
    version: 4,
    createdByMembershipId: ids.practitioner,
    responsiblePractitionerMembershipId: ids.practitioner,
    administeredByMembershipId: null,
    administeredOn: '2030-01-08',
    nextDueOn: '2030-07-08',
    vaccineName: 'Rabia',
    vaccineType: null,
    route: null,
    laboratoryName: null,
    lotNumber: 'QA-1',
    expiryOn: '2029-12-31',
    doseText: null,
    notes: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    administeredByDisplayNameSnapshot: null,
    finalizedAt: null,
    finalizedByMembershipId: null,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    createdAt: '2030-01-08T15:00:00.000Z',
    updatedAt: '2030-01-08T15:00:00.000Z',
    parentEncounterStatus: 'DRAFT' as const,
    patient: { id: ids.patient, name: 'Luna', status: 'ACTIVE' as const },
    encounter: { id: ids.encounter, status: 'DRAFT' as const },
    responsiblePractitioner: {
      membershipId: ids.practitioner,
      displayName: 'Dra. Camila',
      licenseNumber: 'MV-1',
    },
    administeredBy: null,
    ...overrides,
  } as VaccinationDetail;
}

function deworming(overrides: Partial<DewormingDetail> = {}) {
  return {
    ...vaccination(),
    productName: 'Prazicuantel',
    dewormingType: 'Interna',
    vaccineName: undefined,
    route: undefined,
    laboratoryName: undefined,
    lotNumber: undefined,
    expiryOn: undefined,
    ...overrides,
  } as unknown as DewormingDetail;
}

function renderActions(
  kind: 'vaccination' | 'deworming' = 'vaccination',
  item: VaccinationDetail | DewormingDetail = vaccination(),
) {
  return render(
    <MemoryRouter>
      <PreventiveDetailActions
        kind={kind}
        item={item}
        patientId={ids.patient}
        reload={mocks.reload}
      />
    </MemoryRouter>,
  );
}

describe('Preventive care operations UI', () => {
  beforeEach(() => {
    mocks.permissions = new Set();
    mocks.role = 'PRACTITIONER';
    mocks.finalize.mockReset().mockResolvedValue({});
    mocks.voidRecord.mockReset().mockResolvedValue({});
    mocks.reload.mockReset();
  });

  it('shows edit only for a draft with update permission', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_UPDATE_DRAFT);
    renderActions();
    expect(screen.getByRole('link', { name: 'Editar borrador' })).toBeInTheDocument();
  });
  it('does not show edit for finalized records', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_UPDATE_DRAFT);
    renderActions('vaccination', vaccination({ status: 'FINALIZED' }));
    expect(screen.queryByRole('link', { name: 'Editar borrador' })).not.toBeInTheDocument();
  });
  it('shows finalize only to the responsible practitioner', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_FINALIZE);
    renderActions();
    expect(screen.getByRole('button', { name: 'Finalizar vacunación' })).toBeInTheDocument();
  });
  it('explains why another practitioner cannot finalize', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_FINALIZE);
    renderActions(
      'vaccination',
      vaccination({ responsiblePractitionerMembershipId: ids.assistant }),
    );
    expect(screen.getByText(/debe ser finalizado por/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finalizar vacunación' })).not.toBeInTheDocument();
  });
  it('does not show finalize to an assistant', () => {
    mocks.role = 'CLINICAL_ASSISTANT';
    mocks.permissions.add(PERMISSION.VACCINATIONS_FINALIZE);
    renderActions();
    expect(screen.queryByRole('button', { name: 'Finalizar vacunación' })).not.toBeInTheDocument();
  });
  it('blocks finalize before request when required fields are missing', async () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_FINALIZE);
    renderActions('vaccination', vaccination({ administeredOn: null, vaccineName: null }));
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar vacunación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar finalización' }));
    expect(mocks.finalize).not.toHaveBeenCalled();
    expect(screen.getByText(/fecha de aplicación es obligatoria/)).toBeInTheDocument();
  });
  it('shows expiry warning without blocking review', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_FINALIZE);
    renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar vacunación' }));
    expect(screen.getByText(/vencimiento registrado es anterior/)).toBeInTheDocument();
  });
  it('sends only expectedVersion on vaccination finalize', async () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_FINALIZE);
    renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar vacunación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar finalización' }));
    await waitFor(() =>
      expect(mocks.finalize).toHaveBeenCalledWith(
        ids.record,
        { expectedVersion: 4 },
        expect.any(AbortSignal),
      ),
    );
  });
  it('renders administered-by profile warning for incomplete member', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_FINALIZE);
    renderActions(
      'vaccination',
      vaccination({
        administeredByMembershipId: ids.assistant,
        administeredBy: {
          membershipId: ids.assistant,
          displayName: null,
          licenseNumber: null,
          clinicalRole: null,
        },
      }),
    );
    expect(screen.getByText(/miembro registrado como administrador/)).toBeInTheDocument();
  });
  it('allows void only after finalization', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_VOID);
    renderActions('vaccination', vaccination({ status: 'FINALIZED' }));
    expect(screen.getByRole('button', { name: 'Anular vacunación' })).toBeInTheDocument();
  });
  it('does not show void on a draft', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_VOID);
    renderActions();
    expect(screen.queryByRole('button', { name: 'Anular vacunación' })).not.toBeInTheDocument();
  });
  it('requires a void reason', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_VOID);
    renderActions('vaccination', vaccination({ status: 'FINALIZED' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anular vacunación' }));
    expect(screen.getByRole('button', { name: 'Confirmar anulación' })).toBeDisabled();
  });
  it('sends expectedVersion and reason when voiding', async () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_VOID);
    renderActions('vaccination', vaccination({ status: 'FINALIZED' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anular vacunación' }));
    fireEvent.change(screen.getByLabelText('Motivo de anulación'), {
      target: { value: 'Registro duplicado' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
    await waitFor(() =>
      expect(mocks.voidRecord).toHaveBeenCalledWith(
        ids.record,
        { expectedVersion: 4, reason: 'Registro duplicado' },
        expect.any(AbortSignal),
      ),
    );
  });
  it('allows void on an archived patient', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_VOID);
    renderActions(
      'vaccination',
      vaccination({
        status: 'FINALIZED',
        patient: { id: ids.patient, name: 'Luna', status: 'ARCHIVED' },
      }),
    );
    expect(screen.getByRole('button', { name: 'Anular vacunación' })).toBeInTheDocument();
  });
  it('keeps a finalized preventive record finalized when parent is voided', () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_VOID);
    renderActions(
      'vaccination',
      vaccination({ status: 'FINALIZED', parentEncounterStatus: 'VOIDED' }),
    );
    expect(screen.getByRole('button', { name: 'Anular vacunación' })).toBeInTheDocument();
  });
  it('supports the separate deworming finalize operation', async () => {
    mocks.permissions.add(PERMISSION.DEWORMINGS_FINALIZE);
    renderActions('deworming', deworming());
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar desparasitación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar finalización' }));
    await waitFor(() =>
      expect(mocks.finalize).toHaveBeenCalledWith(
        ids.record,
        { expectedVersion: 4 },
        expect.any(AbortSignal),
      ),
    );
  });
  it('keeps stale errors recoverable without automatic retry', async () => {
    mocks.permissions.add(PERMISSION.VACCINATIONS_FINALIZE);
    mocks.finalize.mockRejectedValueOnce(new ApiError('stale', 409, 'VACCINATION_STALE'));
    renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar vacunación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar finalización' }));
    await waitFor(() =>
      expect(screen.getByText(/modificado desde otra sesión/)).toBeInTheDocument(),
    );
    expect(mocks.finalize).toHaveBeenCalledTimes(1);
  });
});
