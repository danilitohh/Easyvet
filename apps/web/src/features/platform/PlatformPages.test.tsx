import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PlatformAccountsPage,
  PlatformActivityPage,
  PlatformOverviewPage,
  PlatformOrganizationsPage,
  PlatformOrganizationDetailPage,
  PlatformSubscriptionsPage,
} from './PlatformPages';
import { platformApi } from './platformApi';
import { findUnnamedActions, findUnlabeledFormControls } from '../../test/accessibility';

vi.mock('./platformApi', () => ({
  platformApi: {
    overview: vi.fn(),
    databasePosture: vi.fn(),
    platformAccounts: vi.fn(),
    organizations: vi.fn(),
    updateOrganizationStatus: vi.fn(),
    activity: vi.fn(),
    createPlatformAccount: vi.fn(),
    updatePlatformAccountStatus: vi.fn(),
    organizationDetail: vi.fn(),
    subscriptionPlans: vi.fn(),
    subscriptions: vi.fn(),
    assignSubscription: vi.fn(),
  },
}));

const organizationId = 'c2d02a42-e03a-4f78-99e9-78186c2a7851';
const adminAccountId = '28623093-3b5b-4a6a-a624-6b5c9b043f4d';
const activityEvent = {
  id: '4a86a228-d9f5-4672-a566-47ad8d5355f5',
  action: 'ORGANIZATION_STATUS_CHANGED' as const,
  organizationName: 'Clínica Central',
  actorEmail: 'admin@easyvet.co',
  metadata: { from: 'ACTIVE', to: 'SUSPENDED', reason: 'Revisión de soporte' },
  createdAt: '2026-10-15T14:00:00.000Z',
};

describe('PlatformOverviewPage database posture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.overview).mockResolvedValue({
      organizations: { total: 0, active: 0, suspended: 0, archived: 0 },
      users: { total: 1, active: 1 },
      memberships: { active: 0 },
      recentOrganizations: [],
    });
    vi.mocked(platformApi.databasePosture).mockResolvedValue({
      role: 'postgres',
      bypassesRowLevelSecurity: true,
      superuser: false,
    });
  });

  it('shows a clear warning when the runtime role can bypass RLS', async () => {
    render(
      <MemoryRouter>
        <PlatformOverviewPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Puede omitir RLS')).toBeInTheDocument();
    expect(screen.getByText('postgres')).toBeInTheDocument();
    expect(
      screen.getByText(/no verifica las políticas RLS ni el aislamiento entre clínicas/i),
    ).toBeInTheDocument();
  });

  it('keeps the platform overview available if the role diagnostic fails', async () => {
    vi.mocked(platformApi.databasePosture).mockRejectedValue(new Error('unavailable'));
    render(
      <MemoryRouter>
        <PlatformOverviewPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText('No fue posible consultar el rol de base de datos del runtime.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Una vista clara de toda la plataforma.' }),
    ).toBeInTheDocument();
  });
});

describe('PlatformActivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.activity).mockResolvedValue({
      data: [activityEvent],
      total: 21,
      page: 1,
      pageSize: 20,
      pageCount: 2,
    });
  });

  it('sends filter and pagination state to the server and advances pages', async () => {
    render(<PlatformActivityPage />);

    expect(await screen.findByText('Clínica Central · ACTIVE → SUSPENDED')).toBeInTheDocument();
    expect(platformApi.activity).toHaveBeenCalledWith(
      { search: '', action: 'ALL', from: '', to: '', page: 1, pageSize: 20 },
      expect.anything(),
    );
    fireEvent.change(screen.getByLabelText('Buscar por correo o clínica'), {
      target: { value: 'central' },
    });
    fireEvent.change(screen.getByLabelText('Tipo de acción'), {
      target: { value: 'ORGANIZATION_STATUS_CHANGED' },
    });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-15' } });

    await waitFor(() =>
      expect(platformApi.activity).toHaveBeenLastCalledWith(
        {
          search: 'central',
          action: 'ORGANIZATION_STATUS_CHANGED',
          from: '2026-10-01',
          to: '2026-10-15',
          page: 1,
          pageSize: 20,
        },
        expect.anything(),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() =>
      expect(platformApi.activity).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
        expect.anything(),
      ),
    );
  });

  it('keeps activity filters and pagination actions accessible', async () => {
    const view = render(<PlatformActivityPage />);

    await screen.findByText('Clínica Central · ACTIVE → SUSPENDED');
    expect(findUnlabeledFormControls(view.container)).toEqual([]);
    expect(findUnnamedActions(view.container)).toEqual([]);
  });
});

describe('PlatformOrganizationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.organizationDetail).mockResolvedValue({
      id: organizationId,
      name: 'Clínica Central',
      slug: 'clinica-central',
      status: 'ACTIVE',
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
      memberCount: 2,
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
      memberships: {
        total: 2,
        active: 2,
        invited: 0,
        suspended: 0,
        byRole: [
          { role: 'OWNER', count: 1 },
          { role: 'VETERINARIAN', count: 1 },
        ],
      },
      locations: {
        total: 1,
        data: [
          {
            id: '6a58a437-91ee-4f66-94e9-3e6853b086c2',
            name: 'Sede principal',
            status: 'ACTIVE',
            city: 'Bogotá',
          },
        ],
      },
      recentAdministrativeActivity: [],
    });
    vi.mocked(platformApi.subscriptionPlans).mockResolvedValue({
      data: [
        {
          id: '7a9e751a-3238-40d8-9318-9a7cfb8bcf37',
          code: 'ESSENTIAL',
          name: 'Esencial',
          eyebrow: 'Para comenzar',
          description: 'Una base clara para comenzar.',
          currencyCode: 'COP',
          monthlyPrice: '0.00',
          annualPrice: '0.00',
          annualDiscountPercent: null,
          features: ['Agenda organizada'],
        },
        {
          id: '91b0959f-58f1-4aa4-86f5-a6dc823e2776',
          code: 'GROWTH',
          name: 'Crecimiento',
          eyebrow: 'Para equipos en expansión',
          description: 'Más contexto para tu equipo.',
          currencyCode: 'COP',
          monthlyPrice: null,
          annualPrice: null,
          annualDiscountPercent: null,
          features: ['Inventario conectado'],
        },
      ],
    });
    vi.mocked(platformApi.subscriptions).mockResolvedValue({
      data: [
        {
          id: organizationId,
          name: 'Clínica Central',
          slug: 'clinica-central',
          organizationStatus: 'ACTIVE',
          subscription: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(platformApi.assignSubscription).mockResolvedValue({
      id: 'db9396a8-f59e-4be8-bf3e-8aa55c5b3525',
      organization: { id: organizationId, name: 'Clínica Central' },
      plan: { code: 'GROWTH', name: 'Crecimiento' },
      status: 'TRIAL',
      interval: 'MONTHLY',
      startsAt: '2026-10-15T00:00:00.000Z',
      trialEndsAt: '2026-11-15T00:00:00.000Z',
      endsAt: null,
    });
  });

  it('renders clinic metadata and aggregate data without personal or clinical records', async () => {
    render(
      <MemoryRouter initialEntries={[`/plataforma/clinicas/${organizationId}`]}>
        <Routes>
          <Route
            path="/plataforma/clinicas/:organizationId"
            element={<PlatformOrganizationDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Clínica Central' })).toBeInTheDocument();
    expect(screen.getByText('Sede principal')).toBeInTheDocument();
    expect(screen.getByText('Veterinario/a')).toBeInTheDocument();
    expect(screen.getByText(/no se exponen cuentas personales/i)).toBeInTheDocument();
    expect(screen.queryByText('Luna')).not.toBeInTheDocument();
    expect(platformApi.organizationDetail).toHaveBeenCalledWith(organizationId, expect.anything());
  });

  it('assigns a plan using the manual admin flow and preserves unset prices', async () => {
    render(
      <MemoryRouter initialEntries={['/plataforma/suscripciones']}>
        <Routes>
          <Route path="/plataforma/suscripciones" element={<PlatformSubscriptionsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Crecimiento')).toBeInTheDocument();
    expect(screen.getByText('Precio por definir')).toBeInTheDocument();
    expect(screen.getByText(/Anual: Precio por definir/)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Asignar plan' }));
    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'GROWTH' } });
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'TRIAL' } });
    fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-10-15' } });
    fireEvent.change(screen.getByLabelText('Fin de prueba'), {
      target: { value: '2026-11-15' },
    });
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), {
      target: { value: 'Prueba aprobada por soporte' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar suscripción' }));

    await waitFor(() =>
      expect(platformApi.assignSubscription).toHaveBeenCalledWith(
        organizationId,
        expect.objectContaining({
          planCode: 'GROWTH',
          status: 'TRIAL',
          interval: 'MONTHLY',
          trialEndsAt: '2026-11-15',
          reason: 'Prueba aprobada por soporte',
        }),
      ),
    );
  });
});

describe('PlatformOrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.organizations).mockResolvedValue({
      data: [],
      total: 45,
      page: 1,
      pageSize: 20,
    });
  });

  it('requests bounded clinic pages and advances using the server total', async () => {
    render(<PlatformOrganizationsPage />);

    expect(await screen.findByText(/Mostrando 0 de 45 clínicas/)).toBeInTheDocument();
    expect(platformApi.organizations).toHaveBeenCalledWith(
      { search: '', status: 'ALL', page: 1, pageSize: 20 },
      expect.anything(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() =>
      expect(platformApi.organizations).toHaveBeenLastCalledWith(
        { search: '', status: 'ALL', page: 2, pageSize: 20 },
        expect.anything(),
      ),
    );
  });
});

describe('PlatformAccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(platformApi.platformAccounts).mockResolvedValue({
      data: [
        {
          id: adminAccountId,
          email: 'admin-team@easyvet.co',
          status: 'ACTIVE',
          createdAt: '2026-10-15T10:00:00.000Z',
        },
      ],
      total: 21,
      page: 1,
      pageSize: 20,
    });
    vi.mocked(platformApi.createPlatformAccount).mockResolvedValue({
      account: {
        id: adminAccountId,
        email: 'new-admin@easyvet.co',
        status: 'ACTIVE',
        createdAt: '2026-10-15T10:00:00.000Z',
      },
      temporaryPassword: 'Secure-Temp-Password-1024',
    });
    vi.mocked(platformApi.updatePlatformAccountStatus).mockResolvedValue({
      id: adminAccountId,
      email: 'admin-team@easyvet.co',
      status: 'SUSPENDED',
      createdAt: '2026-10-15T10:00:00.000Z',
    });
  });

  it('creates an isolated platform account and displays its temporary credential once', async () => {
    render(<PlatformAccountsPage />);

    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'new-admin@easyvet.co' },
    });
    fireEvent.change(screen.getByLabelText('Motivo de creación'), {
      target: { value: 'Nueva integrante del equipo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Secure-Temp-Password-1024')).toBeInTheDocument();
    expect(screen.getByText(/Se solicitará cambiarla al ingresar/)).toBeInTheDocument();
    expect(platformApi.createPlatformAccount).toHaveBeenCalledWith({
      email: 'new-admin@easyvet.co',
      reason: 'Nueva integrante del equipo',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar clave' }));
    expect(screen.queryByText('Secure-Temp-Password-1024')).not.toBeInTheDocument();
  });

  it('requests server-side account pages and advances through the result set', async () => {
    render(<PlatformAccountsPage />);

    expect(
      await screen.findByText('Mostrando 1 de 21 cuentas de super admin.'),
    ).toBeInTheDocument();
    expect(platformApi.platformAccounts).toHaveBeenCalledWith(
      { search: '', page: 1, pageSize: 20 },
      expect.anything(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() =>
      expect(platformApi.platformAccounts).toHaveBeenLastCalledWith(
        { search: '', page: 2, pageSize: 20 },
        expect.anything(),
      ),
    );
  });

  it('requires a reason before changing an account status', async () => {
    render(<PlatformAccountsPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Suspender' }));
    fireEvent.change(screen.getByLabelText('Motivo del cambio'), {
      target: { value: 'Acceso temporalmente suspendido' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

    await waitFor(() =>
      expect(platformApi.updatePlatformAccountStatus).toHaveBeenCalledWith(adminAccountId, {
        status: 'SUSPENDED',
        reason: 'Acceso temporalmente suspendido',
      }),
    );
  });
});
