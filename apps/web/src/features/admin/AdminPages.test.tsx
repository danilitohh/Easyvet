import type {
  ActiveMembership,
  CommercialReportResponse,
  MembershipResponse,
  OperationalReportResponse,
  PaginatedMembershipResponse,
} from '@veterinary-saas/contracts';
import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, defaultContext } from '../../contexts/auth-context';
import { adminApi } from './adminApi';
import { MemberCreatePage, UsersListPage } from './UsersPages';
import { ReportsPage } from './ReportsPage';
import { SettingsPage } from './SettingsPage';

const mocks = vi.hoisted(() => ({ permissions: {} as Record<string, boolean> }));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions[permission] ?? false,
}));
vi.mock('./adminApi', () => ({
  adminApi: {
    listMembers: vi.fn(),
    getMember: vi.fn(),
    createMember: vi.fn(),
    updateMember: vi.fn(),
    setMemberStatus: vi.fn(),
    currentOrganization: vi.fn(),
    organizationSettings: vi.fn(),
    updateOrganization: vi.fn(),
    commercialSettings: vi.fn(),
    updateCommercialSettings: vi.fn(),
    listLocations: vi.fn(),
    createLocation: vi.fn(),
    updateLocation: vi.fn(),
    setLocationStatus: vi.fn(),
    operationalReport: vi.fn(),
    clinicalReport: vi.fn(),
    commercialReport: vi.fn(),
    inventoryReport: vi.fn(),
  },
}));

const organizationNorth = '11111111-1111-4111-8111-111111111111';
const organizationSouth = '22222222-2222-4222-8222-222222222222';
const membershipId = '33333333-3333-4333-8333-333333333333';

function activeMembership(
  organizationId: string,
  role: ActiveMembership['role'] = 'OWNER',
  clinicalRole: ActiveMembership['clinicalRole'] = null,
): ActiveMembership {
  return {
    id: membershipId,
    role,
    clinicalRole,
    status: 'ACTIVE',
    organization: {
      id: organizationId,
      name: organizationId === organizationNorth ? 'Norte' : 'Sur',
      slug: 'tenant',
    },
    permissions: [],
  };
}

function membership(
  displayName: string,
  email = `${displayName.toLowerCase()}@example.local`,
): MembershipResponse {
  return {
    id: membershipId,
    user: { email, displayName },
    role: 'RECEPTION',
    clinicalRole: null,
    status: 'ACTIVE',
    professionalProfileConfigured: false,
  };
}

function renderWithAuth(element: ReactNode, member = activeMembership(organizationNorth)) {
  return render(
    <AuthContext.Provider value={{ ...defaultContext, activeMembership: member }}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('Fase 10 administration pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.permissions = {
      'members.read': true,
      'members.create': true,
      'members.update': true,
      'members.suspend': true,
      'organizationSettings.read': true,
      'organizationSettings.update': true,
      'reports.operational.read': true,
      'reports.clinical.read': true,
      'reports.commercial.read': true,
      'reports.inventory.read': true,
    };
  });

  it('shows a new account temporary password once in an in-memory creation dialog', async () => {
    vi.mocked(adminApi.createMember).mockResolvedValue({
      membership: membership('Camila'),
      accountAlreadyExisted: false,
      temporaryPassword: 'Abcdefghijkmnp23456789',
    });
    renderWithAuth(<MemberCreatePage />);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'camila@example.local' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la organización' }));

    expect(await screen.findByRole('dialog', { name: 'Cuenta creada' })).toBeInTheDocument();
    expect(
      screen.getByText('Esta contraseña se muestra una sola vez. Compártela de forma segura.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña temporal')).toHaveTextContent(
      'Abcdefghijkmnp23456789',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByText('Abcdefghijkmnp23456789')).not.toBeInTheDocument();
  });

  it('does not offer OWNER assignment to an ADMIN in the creation form', () => {
    renderWithAuth(<MemberCreatePage />, activeMembership(organizationNorth, 'ADMIN'));
    expect(screen.queryByRole('option', { name: 'Propietario' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Administrador' })).toBeInTheDocument();
  });

  it('explains that an existing Easyvet account was added without showing a password', async () => {
    vi.mocked(adminApi.createMember).mockResolvedValue({
      membership: membership('Alex'),
      accountAlreadyExisted: true,
      temporaryPassword: null,
    });
    renderWithAuth(<MemberCreatePage />);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), {
      target: { value: 'alex@example.local' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la organización' }));

    expect(await screen.findByRole('dialog', { name: 'Persona agregada' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'La persona ya tenía una cuenta de Easyvet y fue agregada a esta organización.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña temporal')).not.toBeInTheDocument();
  });

  it('hides the previous tenant directory immediately when the active organization changes', async () => {
    let releaseSouth: ((value: PaginatedMembershipResponse) => void) | undefined;
    vi.mocked(adminApi.listMembers)
      .mockResolvedValueOnce({ data: [membership('Norte Staff')], page: 1, pageSize: 25, total: 1 })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseSouth = resolve;
          }),
      );
    const app = (memberContext: ActiveMembership) => (
      <AuthContext.Provider value={{ ...defaultContext, activeMembership: memberContext }}>
        <MemoryRouter initialEntries={['/usuarios']}>
          <Routes>
            <Route path="/usuarios" element={<UsersListPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
    const view = render(app(activeMembership(organizationNorth)));
    expect(await screen.findByText('Norte Staff')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Buscar persona'), {
      target: { value: 'correo privado del tenant norte' },
    });

    view.rerender(app(activeMembership(organizationSouth)));
    expect(screen.queryByText('Norte Staff')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar persona')).toHaveValue('');
    expect(screen.getByLabelText('Rol clínico')).toHaveValue('');
    expect(screen.getByRole('status', { name: 'Cargando equipo…' })).toBeInTheDocument();

    releaseSouth?.({ data: [membership('Sur Staff')], page: 1, pageSize: 25, total: 1 });
    expect(await screen.findByText('Sur Staff')).toBeInTheDocument();
  });

  it('renders commercial totals in separate currency groups', async () => {
    const report: CommercialReportResponse = {
      range: {
        from: '2030-01-01',
        to: '2030-01-30',
        timezone: 'America/Bogota',
        clinicLocationId: null,
      },
      totalsByCurrency: [
        {
          currencyCode: 'COP',
          completedSales: 2,
          voidedSales: 0,
          revenue: '150000',
          discounts: '0',
          averageTicket: '75000',
          voidedValue: '0',
        },
        {
          currencyCode: 'USD',
          completedSales: 1,
          voidedSales: 1,
          revenue: '20',
          discounts: '2',
          averageTicket: '20',
          voidedValue: '5',
        },
      ],
      paymentsByCurrency: [
        { currencyCode: 'COP', method: 'CASH', total: '150000' },
        { currencyCode: 'USD', method: 'CARD', total: '20' },
      ],
      invoices: { issued: 3, voided: 1 },
      cashSessionsByCurrency: [],
    };
    vi.mocked(adminApi.currentOrganization).mockResolvedValue({
      id: organizationNorth,
      name: 'Norte',
      slug: 'norte',
      status: 'ACTIVE',
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    });
    vi.mocked(adminApi.listLocations).mockResolvedValue([]);
    vi.mocked(adminApi.commercialReport).mockResolvedValue(report);
    mocks.permissions = { 'reports.commercial.read': true };

    renderWithAuth(<ReportsPage />);

    expect(await screen.findAllByText(/150\.000/)).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'COP' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'USD' })).toBeInTheDocument();
    expect(screen.getByText(/Monedas separadas/)).toBeInTheDocument();
  });

  it('keeps organization fields in General, validates timezone, and puts currency only in Comercial', async () => {
    vi.mocked(adminApi.organizationSettings).mockResolvedValue({
      id: organizationNorth,
      name: 'Norte',
      slug: 'norte',
      status: 'ACTIVE',
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    });
    vi.mocked(adminApi.commercialSettings).mockResolvedValue({
      currencyCode: 'COP',
      invoicePrefix: 'EV',
    });
    vi.mocked(adminApi.listLocations).mockResolvedValue([]);
    renderWithAuth(<SettingsPage />);

    expect(await screen.findByRole('tab', { name: 'General' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Moneda predeterminada')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Zona horaria'), { target: { value: 'Mars/Olympus' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(
      await screen.findByText('Ingresa una zona horaria IANA válida, por ejemplo America/Bogota.'),
    ).toBeInTheDocument();
    expect(adminApi.updateOrganization).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('tab', { name: 'Comercial' }));
    expect(screen.getByLabelText('Moneda predeterminada')).toHaveValue('COP');
    expect(screen.queryByLabelText(/Número siguiente de factura/i)).not.toBeInTheDocument();
  });

  it('shows only permitted report tabs and requests a bounded operational range', async () => {
    const operationalReport: OperationalReportResponse = {
      range: {
        from: '2030-01-01',
        to: '2030-01-30',
        timezone: 'America/Bogota',
        clinicLocationId: null,
      },
      appointments: { total: 3, completed: 2, cancelled: 1, noShow: 0 },
      followUps: { open: 2, overdue: 1, dueToday: 0 },
      grooming: { draft: 0, inProgress: 1, completed: 2 },
      hospitalization: { currentlyActive: 1, admissions: 2, discharges: 1 },
    };
    vi.mocked(adminApi.currentOrganization).mockResolvedValue({
      id: organizationNorth,
      name: 'Norte',
      slug: 'norte',
      status: 'ACTIVE',
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    });
    vi.mocked(adminApi.listLocations).mockResolvedValue([]);
    vi.mocked(adminApi.operationalReport).mockResolvedValue(operationalReport);
    mocks.permissions = { 'reports.operational.read': true };

    renderWithAuth(<ReportsPage />, activeMembership(organizationNorth, 'VETERINARIAN'));

    expect(await screen.findByRole('tab', { name: 'Resumen operacional' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Clínico' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Comercial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Inventario' })).not.toBeInTheDocument();
    expect(await screen.findByText('Citas en el rango')).toBeInTheDocument();
    expect(adminApi.operationalReport).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      expect.any(AbortSignal),
    );
    expect(adminApi.organizationSettings).not.toHaveBeenCalled();
  });
});
