import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaleFormPage } from './SaleFormPage';

const mocks = vi.hoisted(() => ({
  resources: [] as Array<{
    data: unknown;
    error: null;
    loading: false;
    reload: ReturnType<typeof vi.fn>;
  }>,
  index: 0,
}));

vi.mock('./useCommercialResource', () => ({
  useCommercialResource: () => mocks.resources[mocks.index++ % mocks.resources.length],
}));
vi.mock('../shared/hooks', () => ({
  useActiveOrganizationId: () => '70000000-0000-4000-8000-000000000001',
}));

function resource(data: unknown) {
  return { data, error: null as null, loading: false as const, reload: vi.fn() };
}

describe('SaleFormPage customer selectors', () => {
  beforeEach(() => {
    mocks.index = 0;
    mocks.resources = [
      resource([
        {
          id: '70000000-0000-4000-8000-000000000002',
          name: 'Sede norte',
          status: 'ACTIVE',
        },
      ]),
      resource({
        data: [
          {
            id: '70000000-0000-4000-8000-000000000003',
            firstName: 'Ana',
            lastName: 'Pérez',
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 35, totalPages: 2 },
      }),
      resource({
        data: [
          {
            id: '70000000-0000-4000-8000-000000000004',
            name: 'Luna',
            owner: { firstName: 'Ana', lastName: 'Pérez' },
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 28, totalPages: 2 },
      }),
      resource({ currencyCode: 'COP' }),
      resource({ data: [], pagination: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }),
      resource(null),
    ];
  });

  it('offers searchable, paginated patients and owners without loading a fixed first-100 list', async () => {
    render(
      <MemoryRouter initialEntries={['/ventas/nueva']}>
        <Routes>
          <Route path="/ventas/nueva" element={<SaleFormPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('option', { name: 'Luna · Ana Pérez' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ana Pérez' })).toBeInTheDocument();
    expect(screen.getByText(/28 pacientes encontrados; página 1 de 2/)).toBeInTheDocument();
    expect(screen.getByText(/35 propietarios encontrados; página 1 de 2/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar paciente'), {
      target: { value: 'Luna' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Paginación de pacientes: página siguiente' }),
    );

    expect(screen.getByLabelText('Buscar paciente')).toHaveValue('Luna');
    expect(screen.getByRole('navigation', { name: 'Paginación de pacientes' })).toBeInTheDocument();
  });
});
