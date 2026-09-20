import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerResponse, PatientResponse, Permission } from '@veterinary-saas/contracts';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../contexts/useAuth';
import { useCan } from '../auth/useCan';
import { PERMISSION } from '../auth/permissions';
import { OwnerListPage } from './owners/OwnerListPage';
import { OwnerDetailPage } from './owners/OwnerDetailPage';
import { OwnerFormPage } from './owners/OwnerFormPage';
import { PatientListPage } from './patients/PatientListPage';
import { PatientDetailPage } from './patients/PatientDetailPage';
import { PatientFormPage } from './patients/PatientFormPage';
import { PermissionRoute } from './shared/ResourceFeedback';
import { ownersApi } from './owners/ownersApi';
import { patientsApi } from './patients/patientsApi';

vi.mock('../contexts/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../auth/useCan', () => ({ useCan: vi.fn() }));
vi.mock('./owners/ownersApi', () => ({
  ownersApi: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  },
}));
vi.mock('./patients/patientsApi', () => ({
  patientsApi: {
    list: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  },
}));

const ownerId = '00000000-0000-4000-8000-000000000101';
const patientId = '00000000-0000-4000-8000-000000000201';
const northId = '00000000-0000-4000-8000-000000000301';
const southId = '00000000-0000-4000-8000-000000000302';

const owner: OwnerResponse = {
  id: ownerId,
  firstName: 'Ana',
  lastName: 'Norte',
  documentType: 'CC',
  documentNumber: '1001',
  email: 'ana@example.com',
  phone: '3001112233',
  secondaryPhone: null,
  address: 'Calle 1',
  city: 'Bogotá',
  notes: 'Prefiere WhatsApp',
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  patients: [{ id: patientId, name: 'Luna', species: 'Canino', status: 'ACTIVE' }],
};

const patient: PatientResponse = {
  id: patientId,
  ownerId,
  name: 'Luna',
  species: 'Canino',
  breed: 'Mestiza',
  sex: 'FEMALE',
  birthDate: '2024-01-15',
  birthDateEstimated: false,
  color: 'Canela',
  microchipNumber: 'ABC123',
  currentWeightKg: 8.4,
  sterilized: true,
  notes: 'Muy tranquila',
  status: 'ACTIVE',
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  owner: {
    id: ownerId,
    firstName: owner.firstName,
    lastName: owner.lastName,
    email: owner.email,
    phone: owner.phone,
    status: owner.status,
  },
};

function membership(organizationId = northId) {
  return {
    id: `00000000-0000-4000-8000-${organizationId.slice(-12)}`,
    role: 'OWNER' as const,
    status: 'ACTIVE' as const,
    organization: {
      id: organizationId,
      name: organizationId === northId ? 'Norte' : 'Sur',
      slug: 'demo',
    },
    permissions: [
      'owners.read',
      'owners.create',
      'owners.update',
      'owners.archive',
      'patients.read',
      'patients.create',
      'patients.update',
      'patients.archive',
    ] as Permission[],
  };
}

function renderRoute(path: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWithParams(path: string, route: string, element: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseCan = vi.mocked(useCan);

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAuth.mockReturnValue({ activeMembership: membership() } as never);
  mockedUseCan.mockReturnValue(true);
});

describe('owners frontend', () => {
  it('renders the Owner list', async () => {
    vi.mocked(ownersApi.list).mockResolvedValue({
      data: [owner],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderRoute('/propietarios', <OwnerListPage />);
    expect(await screen.findByText('Ana Norte')).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
  });

  it('renders the Owner loading state', () => {
    vi.mocked(ownersApi.list).mockReturnValue(new Promise(() => undefined));
    renderRoute('/propietarios', <OwnerListPage />);
    expect(screen.getByRole('status', { name: 'Cargando tabla' })).toBeInTheDocument();
  });

  it('renders the Owner empty state and CTA', async () => {
    vi.mocked(ownersApi.list).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    renderRoute('/propietarios', <OwnerListPage />);
    expect(await screen.findByText('No hay propietarios registrados.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear propietario' })).toHaveAttribute(
      'href',
      '/propietarios/nuevo',
    );
  });

  it('sends the Owner search parameter after debounce', async () => {
    vi.mocked(ownersApi.list).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    renderRoute('/propietarios', <OwnerListPage />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ana' } });
    await waitFor(
      () => expect(ownersApi.list).toHaveBeenCalledWith(expect.objectContaining({ search: 'ana' })),
      { timeout: 1000 },
    );
  });

  it('changes Owner pagination', async () => {
    vi.mocked(ownersApi.list)
      .mockResolvedValueOnce({
        data: [owner],
        pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
      });
    renderRoute('/propietarios', <OwnerListPage />);
    await screen.findByText('Ana Norte');
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() =>
      expect(ownersApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );
  });

  it('sends the selected Owner status filter', async () => {
    vi.mocked(ownersApi.list).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    renderRoute('/propietarios', <OwnerListPage />);
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'ARCHIVED' } });
    await waitFor(() =>
      expect(ownersApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'ARCHIVED' }),
      ),
    );
  });

  it('validates the Owner create form', async () => {
    renderRoute('/propietarios/nuevo', <OwnerFormPage mode="create" />);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar propietario' }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(ownersApi.create).not.toHaveBeenCalled();
  });

  it('shows a friendly Owner document conflict', async () => {
    vi.mocked(ownersApi.create).mockRejectedValue(
      new ApiError('conflict', 409, 'RESOURCE_CONFLICT'),
    );
    renderRoute('/propietarios/nuevo', <OwnerFormPage mode="create" />);
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Tipo de documento'), { target: { value: 'CC' } });
    fireEvent.change(screen.getByLabelText('Número de documento'), { target: { value: '1001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar propietario' }));
    expect(await screen.findByText(/ya existe un propietario/i)).toBeInTheDocument();
  });

  it('precarga and updates an Owner', async () => {
    vi.mocked(ownersApi.findById).mockResolvedValue(owner);
    vi.mocked(ownersApi.update).mockResolvedValue(owner);
    renderWithParams(
      `/propietarios/${ownerId}/editar`,
      '/propietarios/:ownerId/editar',
      <OwnerFormPage mode="edit" />,
    );
    expect(await screen.findByDisplayValue('Ana')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Medellín' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar propietario' }));
    await waitFor(() =>
      expect(ownersApi.update).toHaveBeenCalledWith(
        ownerId,
        expect.objectContaining({ city: 'Medellín' }),
      ),
    );
  });

  it('confirms Owner archive', async () => {
    vi.mocked(ownersApi.findById).mockResolvedValue(owner);
    vi.mocked(ownersApi.archive).mockResolvedValue({
      ...owner,
      status: 'ARCHIVED',
      archivedAt: '2026-02-01T00:00:00.000Z',
    });
    renderWithParams(`/propietarios/${ownerId}`, '/propietarios/:ownerId', <OwnerDetailPage />);
    await screen.findByRole('heading', { name: 'Ana Norte' });
    fireEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    expect(screen.getByRole('dialog', { name: 'Archivar propietario' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivado' }));
    await waitFor(() => expect(ownersApi.archive).toHaveBeenCalledWith(ownerId));
  });

  it('links active patients from Owner detail', async () => {
    vi.mocked(ownersApi.findById).mockResolvedValue(owner);
    renderWithParams(`/propietarios/${ownerId}`, '/propietarios/:ownerId', <OwnerDetailPage />);
    await screen.findByRole('heading', { name: 'Ana Norte' });
    expect(screen.getByRole('link', { name: /luna/i })).toHaveAttribute(
      'href',
      `/pacientes/${patientId}`,
    );
  });

  it('hides Owner archive when permission is missing', async () => {
    vi.mocked(ownersApi.findById).mockResolvedValue(owner);
    mockedUseCan.mockImplementation((permission) => permission !== PERMISSION.OWNERS_ARCHIVE);
    renderWithParams(`/propietarios/${ownerId}`, '/propietarios/:ownerId', <OwnerDetailPage />);
    await screen.findByRole('heading', { name: 'Ana Norte' });
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();
  });

  it('denies direct Owner create route without permission', () => {
    mockedUseCan.mockReturnValue(false);
    renderRoute(
      '/propietarios/nuevo',
      <PermissionRoute permission={PERMISSION.OWNERS_CREATE}>
        <OwnerFormPage mode="create" />
      </PermissionRoute>,
    );
    expect(screen.getByRole('heading', { name: /no tienes permisos/i })).toBeInTheDocument();
  });
});

describe('patients frontend', () => {
  it('renders the Patient list and Owner summary', async () => {
    vi.mocked(patientsApi.list).mockResolvedValue({
      data: [patient],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderRoute('/pacientes', <PatientListPage />);
    expect(await screen.findByText('Luna')).toBeInTheDocument();
    expect(screen.getByText('Ana Norte')).toBeInTheDocument();
  });

  it('renders the Patient empty state', async () => {
    vi.mocked(patientsApi.list).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    renderRoute('/pacientes', <PatientListPage />);
    expect(await screen.findByText('No hay pacientes registrados.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar paciente' })).toHaveAttribute(
      'href',
      '/pacientes/nuevo',
    );
  });

  it('renders Patient detail and calculated age', async () => {
    vi.mocked(patientsApi.findById).mockResolvedValue(patient);
    renderWithParams(`/pacientes/${patientId}`, '/pacientes/:patientId', <PatientDetailPage />);
    expect(await screen.findByRole('heading', { name: 'Luna' })).toBeInTheDocument();
    expect(screen.getByText('Peso actual')).toBeInTheDocument();
    expect(screen.getByText(/años|año|meses|mes/)).toBeInTheDocument();
  });

  it('creates a Patient using the Owner selector', async () => {
    vi.mocked(ownersApi.list).mockResolvedValue({
      data: [owner],
      pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
    });
    vi.mocked(patientsApi.create).mockResolvedValue(patient);
    renderRoute('/pacientes/nuevo', <PatientFormPage mode="create" />);
    const ownerSelect = await screen.findByLabelText('Propietario *');
    await screen.findByRole('option', { name: /ana norte/i });
    fireEvent.change(ownerSelect, { target: { value: ownerId } });
    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Luna' } });
    fireEvent.change(screen.getByLabelText('Especie *'), { target: { value: 'Canino' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar paciente' }));
    await waitFor(() =>
      expect(patientsApi.create).toHaveBeenCalledWith(expect.objectContaining({ ownerId })),
    );
  });

  it('preselects Owner from the Owner detail query string', async () => {
    vi.mocked(ownersApi.findById).mockResolvedValue(owner);
    vi.mocked(ownersApi.list).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    });
    renderRoute(`/pacientes/nuevo?ownerId=${ownerId}`, <PatientFormPage mode="create" />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Propietario *' })).toHaveValue(ownerId),
    );
  });

  it('searches Owners for the Patient selector', async () => {
    vi.mocked(ownersApi.list).mockResolvedValue({
      data: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    });
    renderRoute('/pacientes/nuevo', <PatientFormPage mode="create" />);
    fireEvent.change(screen.getByLabelText('Buscar propietario'), { target: { value: 'ana' } });
    await waitFor(() =>
      expect(ownersApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'ana', pageSize: 50 }),
      ),
    );
  });

  it('edits a Patient without sending ownerId', async () => {
    vi.mocked(patientsApi.findById).mockResolvedValue(patient);
    vi.mocked(patientsApi.update).mockResolvedValue(patient);
    renderWithParams(
      `/pacientes/${patientId}/editar`,
      '/pacientes/:patientId/editar',
      <PatientFormPage mode="edit" />,
    );
    expect(await screen.findByDisplayValue('Luna')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: 'Blanco' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar paciente' }));
    await waitFor(() =>
      expect(patientsApi.update).toHaveBeenCalledWith(
        patientId,
        expect.not.objectContaining({ ownerId }),
      ),
    );
  });

  it('confirms Patient archive', async () => {
    vi.mocked(patientsApi.findById).mockResolvedValue(patient);
    vi.mocked(patientsApi.archive).mockResolvedValue({
      ...patient,
      status: 'ARCHIVED',
      archivedAt: '2026-02-01T00:00:00.000Z',
    });
    renderWithParams(`/pacientes/${patientId}`, '/pacientes/:patientId', <PatientDetailPage />);
    await screen.findByRole('heading', { name: 'Luna' });
    fireEvent.click(screen.getByRole('button', { name: 'Archivar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivado' }));
    await waitFor(() => expect(patientsApi.archive).toHaveBeenCalledWith(patientId));
  });

  it('shows AccessDenied for Patient edit without permission', () => {
    mockedUseCan.mockReturnValue(false);
    renderRoute(
      `/pacientes/${patientId}/editar`,
      <PermissionRoute permission={PERMISSION.PATIENTS_UPDATE}>
        <PatientFormPage mode="edit" />
      </PermissionRoute>,
    );
    expect(screen.getByRole('heading', { name: /no tienes permisos/i })).toBeInTheDocument();
  });

  it('hides Patient archive when permission is missing', async () => {
    vi.mocked(patientsApi.findById).mockResolvedValue(patient);
    mockedUseCan.mockImplementation((permission) => permission !== PERMISSION.PATIENTS_ARCHIVE);
    renderWithParams(`/pacientes/${patientId}`, '/pacientes/:patientId', <PatientDetailPage />);
    await screen.findByRole('heading', { name: 'Luna' });
    expect(screen.queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument();
  });

  it('renders a cross-tenant Patient 404 as a normal NotFound state', async () => {
    vi.mocked(patientsApi.findById).mockRejectedValue(
      new ApiError('not found', 404, 'RESOURCE_NOT_FOUND'),
    );
    renderWithParams(`/pacientes/${patientId}`, '/pacientes/:patientId', <PatientDetailPage />);
    expect(await screen.findByText('Recurso no encontrado')).toBeInTheDocument();
    expect(screen.queryByText(/otra veterinaria/i)).not.toBeInTheDocument();
  });
});

describe('tenant switch cache safety', () => {
  it('clears Owner list data and refetches after organization switch', async () => {
    vi.mocked(ownersApi.list)
      .mockResolvedValueOnce({
        data: [{ ...owner, firstName: 'Norte' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      })
      .mockResolvedValueOnce({
        data: [{ ...owner, id: southId, firstName: 'Sur' }],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });
    let active = membership(northId);
    mockedUseAuth.mockImplementation(() => ({ activeMembership: active }) as never);
    const view = renderRoute('/propietarios', <OwnerListPage />);
    expect(await screen.findByText('Norte Norte')).toBeInTheDocument();
    active = membership(southId);
    view.rerender(
      <MemoryRouter initialEntries={['/propietarios']}>
        <OwnerListPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.queryByText('Norte Norte')).not.toBeInTheDocument());
    expect(await screen.findByText('Sur Norte')).toBeInTheDocument();
  });

  it('clears a cached Patient detail after organization switch', async () => {
    vi.mocked(patientsApi.findById)
      .mockResolvedValueOnce(patient)
      .mockRejectedValueOnce(new ApiError('not found', 404, 'RESOURCE_NOT_FOUND'));
    let active = membership(northId);
    mockedUseAuth.mockImplementation(() => ({ activeMembership: active }) as never);
    const view = renderWithParams(
      `/pacientes/${patientId}`,
      '/pacientes/:patientId',
      <PatientDetailPage />,
    );
    await screen.findByRole('heading', { name: 'Luna' });
    active = membership(southId);
    view.rerender(
      <MemoryRouter initialEntries={[`/pacientes/${patientId}`]}>
        <Routes>
          <Route path="/pacientes/:patientId" element={<PatientDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Luna' })).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Recurso no encontrado')).toBeInTheDocument();
  });
});
