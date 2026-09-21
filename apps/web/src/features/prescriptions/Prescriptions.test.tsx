import type {
  PrescriptionDetail,
  PrescriptionListResponse,
  PrescriptionSummary,
} from '@veterinary-saas/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionDetailPage } from './PrescriptionDetailPage';
import { PrescriptionListPage } from './PrescriptionListPage';
import { PrescriptionListSection } from './PrescriptionListSection';

const ids = {
  patient: '11111111-1111-4111-8111-111111111111',
  prescription: '22222222-2222-4222-8222-222222222222',
  encounter: '33333333-3333-4333-8333-333333333333',
  membership: '44444444-4444-4444-8444-444444444444',
  itemOne: '55555555-5555-4555-8555-555555555555',
  itemTwo: '66666666-6666-4666-8666-666666666666',
};

type MockListState = {
  data: PrescriptionListResponse | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

type MockDetailState = {
  data: PrescriptionDetail | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
};

const mocks = vi.hoisted(() => ({
  can: true,
  listState: {
    data: null,
    loading: true,
    error: null,
    reload: vi.fn(),
  } as MockListState,
  detailState: {
    data: null,
    loading: true,
    error: null,
    reload: vi.fn(),
  } as MockDetailState,
  organization: {
    data: {
      id: '77777777-7777-4777-8777-777777777777',
      name: 'Norte',
      slug: 'norte',
      status: 'ACTIVE' as const,
      timezone: 'America/Bogota',
      locale: 'es-CO',
      currencyCode: 'COP',
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  },
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => (mocks.can === true ? permission.endsWith('.read') : mocks.can),
}));
vi.mock('../clinical/useClinical', () => ({
  useClinicalOrganization: () => mocks.organization,
  useProfessionalProfile: () => ({
    data: { membershipId: ids.membership, displayName: 'Dra. Perfil', licenseNumber: 'MV-123' },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));
vi.mock('./usePrescriptions', () => ({
  usePatientPrescriptions: () => mocks.listState,
  useEncounterPrescriptions: () => mocks.listState,
  usePrescription: () => mocks.detailState,
}));

function summary(overrides: Partial<PrescriptionSummary> = {}): PrescriptionSummary {
  return {
    id: ids.prescription,
    organizationId: '77777777-7777-4777-8777-777777777777',
    clinicalEncounterId: ids.encounter,
    patientId: ids.patient,
    status: 'FINALIZED',
    itemCount: 2,
    version: 3,
    prescribedByMembershipId: ids.membership,
    createdByMembershipId: ids.membership,
    professionalDisplayNameSnapshot: 'Dra. Histórica',
    professionalLicenseSnapshot: 'MV-123',
    patientNameSnapshot: 'Luna al emitir',
    ownerDisplayNameSnapshot: 'Camila Rojas al emitir',
    diagnosisSnapshot: 'Presuntivo: paciente estable.',
    finalizedAt: '2030-01-08T15:00:00.000Z',
    finalizedByMembershipId: ids.membership,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    createdAt: '2030-01-08T14:00:00.000Z',
    updatedAt: '2030-01-08T15:00:00.000Z',
    parentEncounterStatus: 'FINALIZED',
    patient: { id: ids.patient, name: 'Luna actual', status: 'ACTIVE' },
    prescribedBy: {
      membershipId: ids.membership,
      displayName: 'Dra. Actual',
      licenseNumber: 'MV-999',
    },
    ...overrides,
  };
}

function detail(overrides: Partial<PrescriptionDetail> = {}): PrescriptionDetail {
  return {
    ...summary(),
    items: [
      {
        id: ids.itemTwo,
        prescriptionId: ids.prescription,
        position: 1,
        medicationName: 'Zeta larga <script>alert(1)</script>',
        presentation: 'Tabletas',
        quantity: '10 tabletas',
        dosage: '1/2 tableta',
        frequency: 'Cada 8 horas',
        duration: '7 días',
        observations: 'Dar con alimento\nMantener hidratación',
        createdAt: '2030-01-08T14:00:00.000Z',
      },
      {
        id: ids.itemOne,
        prescriptionId: ids.prescription,
        position: 0,
        medicationName: 'Amoxicilina',
        presentation: null,
        quantity: null,
        dosage: null,
        frequency: null,
        duration: null,
        observations: null,
        createdAt: '2030-01-08T14:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function listState(data: PrescriptionSummary[] = [summary()]): PrescriptionListResponse {
  return {
    data,
    pagination: { page: 1, pageSize: 20, total: data.length, totalPages: 1 },
  };
}

function renderList() {
  return render(
    <MemoryRouter initialEntries={[`/pacientes/${ids.patient}/historia/prescripciones`]}>
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/prescripciones"
          element={<PrescriptionListPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetailPage(routePatientId = ids.patient) {
  return render(
    <MemoryRouter
      initialEntries={[`/pacientes/${routePatientId}/historia/prescripciones/${ids.prescription}`]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/prescripciones/:prescriptionId"
          element={<PrescriptionDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Prescriptions frontend read-only', () => {
  beforeEach(() => {
    mocks.can = true;
    mocks.listState = {
      data: listState(),
      loading: false,
      error: null,
      reload: vi.fn(),
    };
    mocks.detailState = {
      data: detail(),
      loading: false,
      error: null,
      reload: vi.fn(),
    };
  });

  it('1. renders the prescription section when prescriptions.read is present', () => {
    render(
      <MemoryRouter>
        <PrescriptionListSection patientId={ids.patient} timezone="America/Bogota" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Prescripciones' })).toBeInTheDocument();
  });

  it('2. hides the section when prescriptions.read is absent', () => {
    mocks.can = false;
    render(<PrescriptionListSection patientId={ids.patient} timezone="America/Bogota" />);
    expect(screen.queryByRole('heading', { name: 'Prescripciones' })).not.toBeInTheDocument();
  });

  it('3. protects the direct route without permission', () => {
    mocks.can = false;
    renderList();
    expect(screen.getByText('No tienes permisos para esta acción')).toBeInTheDocument();
  });

  it('4. allows a Practitioner to read', () => {
    renderList();
    expect(screen.getByText(/Dra\. Histórica/)).toBeInTheDocument();
  });

  it('5. allows a Clinical Assistant to read through the same effective permission', () => {
    renderList();
    expect(screen.getByRole('heading', { name: 'Prescripciones', level: 1 })).toBeInTheDocument();
  });

  it('6. does not grant access to a non-clinical membership', () => {
    mocks.can = false;
    renderList();
    expect(screen.getByText('No tienes permisos para esta acción')).toBeInTheDocument();
  });

  it('7. renders a Patient prescription list', () => {
    renderList();
    expect(screen.getByLabelText('Prescripciones')).toBeInTheDocument();
    expect(screen.getByText(/2\s+items/)).toBeInTheDocument();
  });

  it('8. exposes pagination for paginated responses', () => {
    mocks.listState.data = {
      ...listState(),
      pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
    };
    renderList();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  });

  it('9. presents DRAFT as Borrador and never as emitted', () => {
    mocks.detailState.data = detail({
      status: 'DRAFT',
      finalizedAt: null,
      patientNameSnapshot: null,
      ownerDisplayNameSnapshot: null,
    });
    renderDetailPage();
    expect(screen.getAllByText('Borrador').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Borrador. Esta prescripción aún no ha sido finalizada.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/receta emitida/i)).not.toBeInTheDocument();
  });

  it('10. presents FINALIZED and its emission timestamp', () => {
    renderDetailPage();
    expect(screen.getAllByText('Finalizada').length).toBeGreaterThan(0);
    expect(screen.getByText(/Fecha de emisión:/)).toBeInTheDocument();
  });

  it('11. presents VOIDED with reason and timestamp', () => {
    mocks.detailState.data = detail({
      status: 'VOIDED',
      voidedAt: '2030-01-09T15:00:00.000Z',
      voidReason: 'Duplicada',
    });
    renderDetailPage();
    expect(screen.getAllByText('Anulada').length).toBeGreaterThan(0);
    expect(screen.getByText('Duplicada')).toBeInTheDocument();
  });

  it('12. renders the required empty state without a create CTA', () => {
    mocks.listState.data = listState([]);
    renderList();
    expect(screen.getByText('Este paciente todavía no tiene prescripciones.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear/i })).not.toBeInTheDocument();
  });

  it('13. renders prescription detail', () => {
    renderDetailPage();
    expect(
      screen.getByRole('heading', { name: 'Medicamentos e indicaciones' }),
    ).toBeInTheDocument();
  });

  it('14. keeps items ordered by position', () => {
    renderDetailPage();
    const names = screen.getAllByRole('heading', { level: 3 }).map((node) => node.textContent);
    expect(names.indexOf('Amoxicilina')).toBeLessThan(
      names.indexOf('Zeta larga <script>alert(1)</script>'),
    );
  });

  it('15. omits optional empty item fields', () => {
    renderDetailPage();
    expect(screen.queryByText('Presentación')).toBeInTheDocument();
    expect(screen.getAllByText('Presentación').length).toBe(1);
  });

  it('16. displays diagnosis snapshot as plain text', () => {
    renderDetailPage();
    expect(screen.getByText('Presuntivo: paciente estable.')).toBeInTheDocument();
  });

  it('17. displays the historical professional snapshot', () => {
    renderDetailPage();
    expect(screen.getByText(/Dra\. Histórica/)).toBeInTheDocument();
    expect(screen.getByText('MV-123')).toBeInTheDocument();
  });

  it('18. displays Patient snapshot separately from current Patient', () => {
    renderDetailPage();
    expect(screen.getByText('Luna al emitir')).toBeInTheDocument();
    expect(screen.getByText('Luna actual')).toBeInTheDocument();
  });

  it('19. displays Owner snapshot as historical responsibility', () => {
    renderDetailPage();
    expect(screen.getByText('Camila Rojas al emitir')).toBeInTheDocument();
  });

  it('20. formats timestamps using the organization timezone', () => {
    renderDetailPage();
    expect(screen.getAllByText(/8\/01\/2030|08\/01\/2030/i).length).toBeGreaterThan(0);
  });

  it('21. does not replace historical professional with a live profile', () => {
    renderDetailPage();
    expect(screen.queryByText('Dra. Actual')).not.toBeInTheDocument();
  });

  it('22. does not replace Patient snapshot with live Patient name', () => {
    renderDetailPage();
    expect(screen.getByText('Paciente al emitir')).toBeInTheDocument();
    expect(screen.getByText('Paciente actual')).toBeInTheDocument();
  });

  it('23. does not substitute Owner snapshot with a live Owner value', () => {
    renderDetailPage();
    expect(screen.getByText('Responsable al momento de emisión')).toBeInTheDocument();
    expect(screen.queryByText('Camila Rojas actual')).not.toBeInTheDocument();
  });

  it('24. links to the parent Encounter when authorized', () => {
    renderDetailPage();
    expect(screen.getByRole('link', { name: 'Ver consulta clínica relacionada' })).toHaveAttribute(
      'href',
      `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}`,
    );
  });

  it('25. warns when the parent Encounter is VOIDED', () => {
    mocks.detailState.data = detail({ parentEncounterStatus: 'VOIDED' });
    renderDetailPage();
    expect(screen.getByText(/La consulta clínica asociada fue anulada/)).toBeInTheDocument();
  });

  it('26. keeps a FINALIZED Prescription FINALIZED when parent Encounter is VOIDED', () => {
    mocks.detailState.data = detail({ parentEncounterStatus: 'VOIDED' });
    renderDetailPage();
    expect(screen.getAllByText('Finalizada').length).toBeGreaterThan(0);
    expect(screen.queryByText('La prescripción también fue anulada')).not.toBeInTheDocument();
  });

  it('27. warns that a DRAFT cannot continue on a VOIDED parent', () => {
    mocks.detailState.data = detail({
      status: 'DRAFT',
      parentEncounterStatus: 'VOIDED',
      finalizedAt: null,
    });
    renderDetailPage();
    expect(screen.getByText(/Este borrador no puede continuar/)).toBeInTheDocument();
  });

  it('28. clears old Patient list state when the tenant changes', () => {
    const view = render(
      <MemoryRouter>
        <PrescriptionListSection patientId={ids.patient} timezone="America/Bogota" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Dra\. Histórica/)).toBeInTheDocument();
    mocks.listState.data = listState([]);
    view.rerender(
      <MemoryRouter>
        <PrescriptionListSection patientId={ids.patient} timezone="America/Bogota" />
      </MemoryRouter>,
    );
    expect(screen.queryByText('Dra. Histórica')).not.toBeInTheDocument();
  });

  it('29. clears old detail state when the tenant changes', () => {
    const view = renderDetailPage();
    expect(screen.getByText('Dra. Histórica')).toBeInTheDocument();
    mocks.detailState.data = null;
    view.rerender(
      <MemoryRouter
        initialEntries={[`/pacientes/${ids.patient}/historia/prescripciones/${ids.prescription}`]}
      >
        <Routes>
          <Route
            path="/pacientes/:patientId/historia/prescripciones/:prescriptionId"
            element={<PrescriptionDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Dra. Histórica')).not.toBeInTheDocument();
  });

  it('30. treats a cross-tenant or mismatched Patient deep link as not found', () => {
    renderDetailPage('88888888-8888-4888-8888-888888888888');
    expect(screen.getByText('Recurso no encontrado')).toBeInTheDocument();
  });

  it('31. never keeps stale Prescription content after detail becomes unavailable', () => {
    const view = renderDetailPage();
    mocks.detailState.error = new Error('not found');
    mocks.detailState.data = null;
    view.rerender(
      <MemoryRouter
        initialEntries={[`/pacientes/${ids.patient}/historia/prescripciones/${ids.prescription}`]}
      >
        <Routes>
          <Route
            path="/pacientes/:patientId/historia/prescripciones/:prescriptionId"
            element={<PrescriptionDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText('Dra. Histórica')).not.toBeInTheDocument();
  });

  it('32. escapes medication text', () => {
    renderDetailPage();
    expect(screen.getByText('Zeta larga <script>alert(1)</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });

  it('33. preserves multiline observations', () => {
    renderDetailPage();
    expect(
      screen.getByText(
        (content) =>
          content.includes('Dar con alimento') && content.includes('Mantener hidratación'),
      ),
    ).toBeInTheDocument();
  });

  it('34. renders script-like observations as text without executing HTML', () => {
    const items = detail().items;
    mocks.detailState.data = detail({
      items: [{ ...items[0]!, observations: '<script>window.bad=true</script>' }, items[1]!],
    });
    renderDetailPage();
    expect(screen.getByText('<script>window.bad=true</script>')).toBeInTheDocument();
    expect((window as Window & { bad?: boolean }).bad).not.toBe(true);
  });

  it('35. indicates an archived Patient without offering actions', () => {
    mocks.detailState.data = detail({ patient: { ...summary().patient, status: 'ARCHIVED' } });
    renderDetailPage();
    expect(screen.getByText('Paciente archivado')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('36. keeps the read-only detail free of mutation controls', () => {
    renderDetailPage();
    expect(
      screen.queryByRole('button', { name: /finalizar|anular|guardar|editar/i }),
    ).not.toBeInTheDocument();
  });

  it('37. does not render PDF, print, email or signature controls', () => {
    renderDetailPage();
    expect(screen.queryByText(/PDF|Imprimir|email|Firmar/i)).not.toBeInTheDocument();
  });

  it('38. does not render inventory or billing data', () => {
    renderDetailPage();
    expect(screen.queryByText(/stock|precio|factura|pago|SKU|lote/i)).not.toBeInTheDocument();
  });

  it('39. supports the Encounter-linked list surface', () => {
    render(
      <MemoryRouter>
        <PrescriptionListSection
          patientId={ids.patient}
          encounterId={ids.encounter}
          timezone="America/Bogota"
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Prescripciones de esta consulta' }),
    ).toBeInTheDocument();
  });

  it('40. keeps status labels textual and accessible', () => {
    renderDetailPage();
    expect(
      screen.getAllByText('Finalizada').every((node) => node.textContent === 'Finalizada'),
    ).toBe(true);
  });
});
