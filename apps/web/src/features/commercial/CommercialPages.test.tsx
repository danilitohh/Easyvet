import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CashSessionDetail,
  InvoiceDetail,
  InvoiceSummary,
  SaleDetail,
  SaleSummary,
} from '@veterinary-saas/contracts';
import { BillingPage } from './BillingPage';
import { CashPage } from './CashPage';
import { InvoiceDetailPage } from './InvoiceDetailPage';
import { SaleDetailPage } from './SaleDetailPage';
import { SalesListPage } from './SalesListPage';

const mocks = vi.hoisted(() => ({
  values: [] as Array<{
    data: unknown;
    error: unknown;
    loading: boolean;
    reload: ReturnType<typeof vi.fn>;
  }>,
  index: 0,
  can: true,
  completeSale: vi.fn(),
  createCashMovement: vi.fn(),
}));

vi.mock('./useCommercialResource', () => ({
  useCommercialResource: () => mocks.values[mocks.index++ % mocks.values.length],
}));
vi.mock('../../auth/useCan', () => ({ useCan: () => mocks.can }));
vi.mock('../shared/hooks', () => ({
  useActiveOrganizationId: () => '70000000-0000-4000-8000-000000000001',
}));
vi.mock('./commercialApi', () => ({
  commercialApi: {
    completeSale: mocks.completeSale,
    createCashMovement: mocks.createCashMovement,
  },
}));

const organizationId = '70000000-0000-4000-8000-000000000001';
const locationId = '70000000-0000-4000-8000-000000000002';
const saleId = '70000000-0000-4000-8000-000000000003';
const invoiceId = '70000000-0000-4000-8000-000000000004';
const sessionId = '70000000-0000-4000-8000-000000000005';

const page = <T,>(data: T[]) => ({
  data,
  pagination: { page: 1, pageSize: 20, total: data.length, totalPages: 1 },
});
const resource = (data: unknown) => ({ data, error: null, loading: false, reload: vi.fn() });

const sale: SaleDetail = {
  id: saleId,
  organizationId,
  clinicLocationId: locationId,
  clinicLocationName: 'Norte',
  ownerId: null,
  patientId: null,
  status: 'DRAFT',
  version: 3,
  currencyCode: 'COP',
  subtotal: '100.00',
  discountTotal: '0',
  grandTotal: '100.00',
  customerNameSnapshot: null,
  patientNameSnapshot: null,
  customerDocumentTypeSnapshot: null,
  customerDocumentNumberSnapshot: null,
  createdByMembershipId: '70000000-0000-4000-8000-000000000006',
  completedByMembershipId: null,
  voidedByMembershipId: null,
  voidReason: null,
  paymentSummary: [],
  createdAt: '2035-01-01T10:00:00.000Z',
  completedAt: null,
  voidedAt: null,
  items: [
    {
      id: '70000000-0000-4000-8000-000000000007',
      position: 0,
      itemType: 'SERVICE',
      inventoryItemId: null,
      inventoryBatchId: null,
      description: 'Consulta',
      quantity: '1',
      unitPrice: '100.00',
      discountAmount: '0',
      inventoryItemNameSnapshot: null,
      skuSnapshot: null,
      baseUnitSnapshot: null,
    },
  ],
  payments: [],
  invoice: null,
};

const invoiceSummary: InvoiceSummary = {
  id: invoiceId,
  saleId,
  clinicLocationId: locationId,
  clinicLocationName: 'Norte',
  documentNumber: 'INV-000001',
  status: 'ISSUED',
  currencyCode: 'COP',
  customerNameSnapshot: 'Camila Rojas',
  patientNameSnapshot: 'Luna',
  subtotal: '100.00',
  discountTotal: '0',
  total: '100.00',
  issuedAt: '2035-01-01T10:00:00.000Z',
};

const invoice: InvoiceDetail = {
  ...invoiceSummary,
  organizationName: 'Easyvet Norte',
  customerDocumentTypeSnapshot: null,
  customerDocumentNumberSnapshot: null,
  voidedAt: null,
  voidReason: null,
  items: sale.items,
  payments: [
    {
      id: '70000000-0000-4000-8000-000000000008',
      method: 'CARD',
      status: 'POSTED',
      amount: '100.00',
      reference: null,
      cashSessionId: null,
      paidAt: '2035-01-01T10:00:00.000Z',
      voidedAt: null,
    },
  ],
};

const session: CashSessionDetail = {
  id: sessionId,
  organizationId,
  clinicLocationId: locationId,
  clinicLocationName: 'Norte',
  status: 'OPEN',
  currencyCode: 'COP',
  version: 2,
  openingCashAmount: '50',
  openedAt: '2035-01-01T10:00:00.000Z',
  openedByMembershipId: '70000000-0000-4000-8000-000000000006',
  closedAt: null,
  closedByMembershipId: null,
  expectedCashAmount: '50',
  countedCashAmount: null,
  differenceAmount: null,
  notes: null,
};

function renderAt(path: string, element: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('commercial screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.index = 0;
    mocks.can = true;
    mocks.completeSale.mockResolvedValue(sale);
    mocks.createCashMovement.mockResolvedValue(undefined);
  });

  it('shows sales as tenant-linked records with status and exact currency', async () => {
    const summary: SaleSummary = {
      ...sale,
      status: 'COMPLETED',
      completedAt: '2035-01-01T10:00:00.000Z',
    };
    mocks.values = [resource(page([summary]))];
    renderAt('/ventas', <SalesListPage />);
    expect(await screen.findByText('Venta · Norte')).toBeInTheDocument();
    expect(screen.getByText('Completada')).toBeInTheDocument();
  });

  it('renders billing list and immutable invoice detail with print action', async () => {
    mocks.values = [resource(page([invoiceSummary]))];
    renderAt('/facturacion', <BillingPage />);
    expect(await screen.findByText('INV-000001')).toBeInTheDocument();

    mocks.index = 0;
    mocks.values = [resource(invoice)];
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderAt(`/facturacion/${invoiceId}`, <InvoiceDetailPage />);
    expect(await screen.findByText('Easyvet Norte')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });

  it('submits exact payment totals with the sale compare-and-swap version', async () => {
    mocks.values = [resource(sale), resource({ ...session, clinicLocationId: locationId })];
    renderAt(`/ventas/${saleId}`, <SaleDetailPage />);
    fireEvent.change(await screen.findByLabelText('Importe · COP'), {
      target: { value: '100.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cobrar y completar venta' }));
    await waitFor(() =>
      expect(mocks.completeSale).toHaveBeenCalledWith(
        saleId,
        {
          expectedVersion: 3,
          payments: [{ method: 'CASH', amount: '100.00' }],
        },
        expect.any(AbortSignal),
      ),
    );
  });

  it('posts manual cash movement with a positive amount, reason and current session version', async () => {
    const locations = [
      { id: locationId, name: 'Norte', status: 'ACTIVE', address: null, city: 'Bogotá' },
    ];
    mocks.values = [
      resource(locations),
      resource({ currencyCode: 'COP' }),
      resource(session),
      resource(session),
      resource(page([])),
      resource(page([session])),
    ];
    renderAt('/caja', <CashPage />);
    fireEvent.change(await screen.findByLabelText('Sede'), { target: { value: locationId } });
    fireEvent.change(screen.getByLabelText('Importe · COP'), { target: { value: '12.50' } });
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Fondo de cambio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrada' }));
    await waitFor(() =>
      expect(mocks.createCashMovement).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          expectedVersion: 2,
          type: 'MANUAL_IN',
          amount: '12.50',
          reason: 'Fondo de cambio',
          occurredAt: expect.any(String),
        }),
        expect.any(AbortSignal),
      ),
    );
  });
});
