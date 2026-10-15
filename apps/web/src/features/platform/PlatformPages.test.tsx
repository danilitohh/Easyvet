import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformOrganizationDetailPage, PlatformSubscriptionsPage } from './PlatformPages';
import { platformApi } from './platformApi';

vi.mock('./platformApi', () => ({
  platformApi: {
    organizationDetail: vi.fn(),
    subscriptionPlans: vi.fn(),
    subscriptions: vi.fn(),
    assignSubscription: vi.fn(),
  },
}));

const organizationId = 'c2d02a42-e03a-4f78-99e9-78186c2a7851';

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
      limit: 100,
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
