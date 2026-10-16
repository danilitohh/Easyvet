import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GroomingVisit } from '@veterinary-saas/contracts';
import { PERMISSION } from '../../auth/permissions';
import { GroomingFormPage } from './GroomingFormPage';
import { GroomingQueuePage } from './GroomingQueuePage';
import { GroomingVisitDetailPage } from './GroomingVisitDetailPage';

const mocks = vi.hoisted(() => ({
  organizationId: '10000000-0000-4000-8000-000000000001',
  membershipId: '10000000-0000-4000-8000-000000000002',
  role: 'OWNER' as 'OWNER' | 'GROOMER' | 'RECEPTION',
  permissions: new Set<string>(),
  visit: null as unknown,
  listResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  detailResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  optionsResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  appointmentsResource: { data: null as unknown, loading: false, error: null, reload: vi.fn() },
  listCalls: vi.fn(),
  appointmentCalls: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  start: vi.fn(),
  complete: vi.fn(),
  void: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions.has(permission),
}));
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    activeMembership: {
      id: mocks.membershipId,
      role: mocks.role,
      organization: { id: mocks.organizationId },
    },
  }),
}));
vi.mock('../shared/hooks', () => ({ useActiveOrganizationId: () => mocks.organizationId }));
vi.mock('../clinical/useClinical', () => ({
  useClinicalOrganization: () => ({ data: { timezone: 'America/Bogota' }, loading: false }),
}));
vi.mock('../shared/useClinicalDomainResource', () => ({
  useClinicalMutationGuard: () => ({ signal: () => undefined, isCurrent: () => true }),
}));
vi.mock('./useGroomingResources', () => ({
  useGroomingListResource: (...args: unknown[]) => {
    mocks.listCalls(...args);
    return mocks.listResource;
  },
  useGroomingVisitResource: () => mocks.detailResource,
  useGroomingOptions: () => mocks.optionsResource,
  useGroomingAppointments: (...args: unknown[]) => {
    mocks.appointmentCalls(...args);
    return mocks.appointmentsResource;
  },
}));
vi.mock('./groomingApi', () => ({
  groomingApi: {
    create: mocks.create,
    update: mocks.update,
    start: mocks.start,
    complete: mocks.complete,
    void: mocks.void,
  },
}));

const ids = {
  visit: '10000000-0000-4000-8000-000000000010',
  patient: '10000000-0000-4000-8000-000000000011',
  location: '10000000-0000-4000-8000-000000000012',
  groomer: '10000000-0000-4000-8000-000000000013',
  otherGroomer: '10000000-0000-4000-8000-000000000016',
  appointment: '10000000-0000-4000-8000-000000000014',
};

// Each UI test starts from a realistic tenant-scoped record with lifecycle snapshots.
function visit(overrides: Partial<GroomingVisit> = {}): GroomingVisit {
  return {
    id: ids.visit,
    patientId: ids.patient,
    ownerIdAtTime: '10000000-0000-4000-8000-000000000015',
    clinicLocationId: ids.location,
    appointmentId: null,
    assignedGroomerMembershipId: ids.groomer,
    createdByMembershipId: mocks.membershipId,
    startedByMembershipId: null,
    completedByMembershipId: null,
    voidedByMembershipId: null,
    status: 'DRAFT',
    version: 4,
    serviceSummary: 'Baño y corte',
    coatCondition: null,
    skinObservations: null,
    temperamentNotes: null,
    preServiceNotes: null,
    postServiceNotes: null,
    incidentNotes: null,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    groomerDisplayNameSnapshot: null,
    startedAt: null,
    completedAt: null,
    voidedAt: null,
    voidReason: null,
    createdAt: '2035-01-08T15:00:00.000Z',
    updatedAt: '2035-01-08T15:00:00.000Z',
    patient: {
      id: ids.patient,
      name: 'Luna',
      species: 'DOG',
      status: 'ACTIVE',
      owner: { id: '10000000-0000-4000-8000-000000000015', firstName: 'Camila', lastName: 'Rojas' },
    },
    ownerAtTime: { id: '10000000-0000-4000-8000-000000000015', displayName: 'Camila Rojas' },
    clinicLocation: { id: ids.location, name: 'Sede Norte', status: 'ACTIVE' },
    appointment: null,
    assignedGroomer: { id: ids.groomer, displayName: 'Peluquero QA', role: 'GROOMER' },
    createdBy: { id: mocks.membershipId, displayName: 'Owner QA', role: 'OWNER' },
    completedBy: null,
    voidedBy: null,
    ...overrides,
  } as GroomingVisit;
}

const appointment = {
  id: ids.appointment,
  clinicLocationId: ids.location,
  patientId: ids.patient,
  status: 'SCHEDULED',
  startsAt: '2035-01-08T15:00:00.000Z',
  reason: 'Consulta de rutina',
};

// Routes match the real paths so form params and patient preselection behave like production.
function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/peluqueria" element={<GroomingQueuePage />} />
        <Route path="/peluqueria/nueva" element={<GroomingFormPage mode="create" />} />
        <Route path="/peluqueria/:groomingVisitId" element={<GroomingVisitDetailPage />} />
        <Route
          path="/peluqueria/:groomingVisitId/editar"
          element={<GroomingFormPage mode="edit" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.organizationId = '10000000-0000-4000-8000-000000000001';
  mocks.membershipId = '10000000-0000-4000-8000-000000000002';
  mocks.role = 'OWNER';
  mocks.permissions = new Set([
    PERMISSION.GROOMING_READ,
    PERMISSION.GROOMING_CREATE,
    PERMISSION.GROOMING_UPDATE_DRAFT,
    PERMISSION.GROOMING_PERFORM,
    PERMISSION.GROOMING_COMPLETE,
    PERMISSION.GROOMING_VOID,
    PERMISSION.APPOINTMENTS_READ,
  ]);
  mocks.visit = visit();
  mocks.listResource = {
    data: {
      data: [mocks.visit],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  };
  mocks.detailResource = { data: mocks.visit, loading: false, error: null, reload: vi.fn() };
  mocks.optionsResource = {
    data: {
      patients: {
        data: [
          {
            id: ids.patient,
            name: 'Luna',
            owner: { firstName: 'Camila', lastName: 'Rojas' },
          },
        ],
      },
      locations: [{ id: ids.location, name: 'Sede Norte', status: 'ACTIVE' }],
      groomers: [{ id: ids.groomer, displayName: 'Peluquero QA', role: 'GROOMER' }],
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  };
  mocks.appointmentsResource = {
    data: {
      data: [appointment],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  };
  mocks.create.mockResolvedValue(mocks.visit);
  mocks.update.mockResolvedValue(mocks.visit);
  mocks.start.mockResolvedValue(mocks.visit);
  mocks.complete.mockResolvedValue(mocks.visit);
  mocks.void.mockResolvedValue(mocks.visit);
});

describe('grooming frontend', () => {
  it('shows queue records as plain text and submits operational filters', async () => {
    const unsafeNote = '<script>alert(1)</script>\nPerro tranquilo';
    mocks.visit = visit({ serviceSummary: unsafeNote });
    mocks.listResource.data = {
      data: [mocks.visit],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    };
    renderRoute('/peluqueria');

    expect(
      await screen.findByText(
        (content) => content.includes('<script>') && content.includes('Perro tranquilo'),
      ),
    ).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'IN_PROGRESS' } });
    await waitFor(() =>
      expect(mocks.listCalls).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'IN_PROGRESS' }),
        true,
      ),
    );
  });

  it('preselects a Patient and creates a draft with only a compatible linked Appointment', async () => {
    renderRoute(`/peluqueria/nueva?patientId=${ids.patient}`);

    expect(screen.getByLabelText('Paciente')).toHaveValue(ids.patient);
    expect(mocks.appointmentCalls).toHaveBeenLastCalledWith(ids.patient, true, undefined);
    fireEvent.change(screen.getByLabelText('Sede'), { target: { value: ids.location } });
    expect(
      screen.getByRole('option', { name: /Consulta de rutina · SCHEDULED/ }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Cita vinculada (opcional)'), {
      target: { value: ids.appointment },
    });
    fireEvent.change(screen.getByLabelText('Peluquero responsable'), {
      target: { value: ids.groomer },
    });
    fireEvent.change(screen.getByLabelText('Servicio solicitado'), {
      target: { value: '<b>Baño medicado</b>\nSin precio' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        ids.patient,
        expect.objectContaining({
          clinicLocationId: ids.location,
          appointmentId: ids.appointment,
          assignedGroomerMembershipId: ids.groomer,
          serviceSummary: '<b>Baño medicado</b>\nSin precio',
        }),
        undefined,
      ),
    );
  });

  it('lets any Groomer with perform permission start without granting void authority', async () => {
    mocks.role = 'GROOMER';
    mocks.membershipId = ids.otherGroomer;
    mocks.permissions = new Set([PERMISSION.GROOMING_READ, PERMISSION.GROOMING_PERFORM]);
    renderRoute(`/peluqueria/${ids.visit}`);

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar atención' }));
    expect(screen.getByText('Versión revisada:')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar inicio' }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith(ids.visit, 4, undefined));
    expect(screen.queryByRole('button', { name: 'Anular registro' })).not.toBeInTheDocument();
  });

  it('reviews the location and linked Appointment before starting when Agenda is readable', async () => {
    mocks.visit = visit({ appointmentId: ids.appointment, appointment: { ...appointment } });
    mocks.detailResource.data = mocks.visit;
    renderRoute(`/peluqueria/${ids.visit}`);

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar atención' }));

    expect(screen.getByText('Sede:').closest('p')).toHaveTextContent('Sede: Sede Norte');
    expect(screen.getByText('Cita relacionada:').closest('p')).toHaveTextContent(
      /Cita relacionada:.*Consulta de rutina.*SCHEDULED/,
    );
  });

  it('completes an active service using its current CAS version', async () => {
    mocks.role = 'GROOMER';
    mocks.membershipId = ids.otherGroomer;
    mocks.permissions = new Set([PERMISSION.GROOMING_READ, PERMISSION.GROOMING_COMPLETE]);
    mocks.visit = visit({
      status: 'IN_PROGRESS',
      version: 7,
      startedAt: '2035-01-08T15:00:00.000Z',
    });
    mocks.detailResource.data = mocks.visit;
    renderRoute(`/peluqueria/${ids.visit}`);

    fireEvent.click(await screen.findByRole('button', { name: 'Completar servicio' }));
    fireEvent.change(screen.getByLabelText('Notas posteriores'), {
      target: { value: 'Pelaje seco\n<script>no se ejecuta</script>' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar finalización' }));

    await waitFor(() =>
      expect(mocks.complete).toHaveBeenCalledWith(
        ids.visit,
        {
          expectedVersion: 7,
          postServiceNotes: 'Pelaje seco\n<script>no se ejecuta</script>',
          incidentNotes: '',
        },
        undefined,
      ),
    );
  });

  it('shows immutable appointment, location and Groomer context while editing in progress', async () => {
    mocks.role = 'GROOMER';
    mocks.membershipId = ids.otherGroomer;
    mocks.permissions = new Set([
      PERMISSION.GROOMING_READ,
      PERMISSION.GROOMING_UPDATE_DRAFT,
      PERMISSION.GROOMING_PERFORM,
      PERMISSION.APPOINTMENTS_READ,
    ]);
    mocks.visit = visit({
      status: 'IN_PROGRESS',
      startedAt: '2035-01-08T15:00:00.000Z',
      appointmentId: ids.appointment,
      appointment: { ...appointment },
      patientNameSnapshot: 'Nala al iniciar',
      ownerDisplayNameSnapshot: 'Andrés Gil al iniciar',
      groomerDisplayNameSnapshot: 'Peluquero QA al iniciar',
    });
    mocks.detailResource.data = mocks.visit;
    renderRoute(`/peluqueria/${ids.visit}/editar`);

    expect(await screen.findByText('Sede Norte')).toBeInTheDocument();
    expect(screen.getByText('Peluquero QA al iniciar')).toBeInTheDocument();
    expect(screen.getByText('Consulta de rutina · SCHEDULED')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Sede' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Peluquero responsable' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Cita vinculada (opcional)' }),
    ).not.toBeInTheDocument();
  });

  it('requires a void reason and only exposes void to a permitted Owner', async () => {
    mocks.visit = visit({
      status: 'COMPLETED',
      version: 8,
      completedAt: '2035-01-08T16:00:00.000Z',
    });
    mocks.detailResource.data = mocks.visit;
    renderRoute(`/peluqueria/${ids.visit}`);

    fireEvent.click(await screen.findByRole('button', { name: 'Anular registro' }));
    const confirm = screen.getByRole('button', { name: 'Confirmar anulación' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo obligatorio'), {
      target: { value: 'Registro ficticio duplicado' },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mocks.void).toHaveBeenCalledWith(
        ids.visit,
        { expectedVersion: 8, reason: 'Registro ficticio duplicado' },
        undefined,
      ),
    );
  });

  it('does not show Agenda links without appointment-read permission', async () => {
    mocks.permissions.delete(PERMISSION.APPOINTMENTS_READ);
    mocks.visit = visit({ appointmentId: ids.appointment, appointment: { ...appointment } });
    mocks.detailResource.data = mocks.visit;
    renderRoute(`/peluqueria/${ids.visit}`);

    expect(screen.queryByRole('link', { name: /Consulta de rutina/ })).not.toBeInTheDocument();
  });
});
