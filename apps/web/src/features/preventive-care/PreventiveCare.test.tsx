import type {
  DewormingDetail,
  DewormingListResponse,
  DewormingSummary,
  VaccinationDetail,
  VaccinationListResponse,
  VaccinationSummary,
} from '@veterinary-saas/contracts';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DewormingDetailPage } from './DewormingDetailPage';
import { DewormingListSection } from './DewormingListSection';
import { PreventiveCarePage } from './PreventiveCarePage';
import { VaccinationDetailPage } from './VaccinationDetailPage';
import { VaccinationListSection } from './VaccinationListSection';
import { formatCivilDate } from './preventiveUtils';

const ids = {
  organization: '77777777-7777-4777-8777-777777777777',
  patient: '11111111-1111-4111-8111-111111111111',
  patientSur: '88888888-8888-4888-8888-888888888888',
  vaccination: '22222222-2222-4222-8222-222222222222',
  deworming: '33333333-3333-4333-8333-333333333333',
  encounter: '44444444-4444-4444-8444-444444444444',
  membership: '55555555-5555-4555-8555-555555555555',
  assistant: '66666666-6666-4666-8666-666666666666',
};

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>([
    'vaccinations.read',
    'dewormings.read',
    'clinicalEncounters.read',
    'patients.read',
  ]),
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
  patient: {
    patient: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Luna actual',
      species: 'DOG',
      breed: 'Mestiza',
      status: 'ACTIVE' as const,
    },
    loading: false,
    error: null,
    reload: vi.fn(),
  },
  vaccinationList: null as VaccinationListResponse | null,
  dewormingList: null as DewormingListResponse | null,
  vaccinationDetail: null as VaccinationDetail | null,
  dewormingDetail: null as DewormingDetail | null,
  vaccinationsHook: vi.fn(),
  dewormingsHook: vi.fn(),
  vaccinationHook: vi.fn(),
  dewormingHook: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions.has(permission),
}));
vi.mock('../clinical/useClinical', () => ({
  useClinicalOrganization: () => mocks.organization,
}));
vi.mock('../patients/usePatients', () => ({
  usePatient: () => mocks.patient,
}));
vi.mock('./useVaccinations', () => ({
  usePatientVaccinations: (...args: unknown[]) => {
    mocks.vaccinationsHook(...args);
    return {
      data: mocks.vaccinationList,
      loading: false,
      error: null,
      reload: vi.fn(),
    };
  },
  useVaccination: (...args: unknown[]) => {
    mocks.vaccinationHook(...args);
    return {
      data: mocks.vaccinationDetail,
      loading: false,
      error: null,
      reload: vi.fn(),
    };
  },
}));
vi.mock('./useDewormings', () => ({
  usePatientDewormings: (...args: unknown[]) => {
    mocks.dewormingsHook(...args);
    return {
      data: mocks.dewormingList,
      loading: false,
      error: null,
      reload: vi.fn(),
    };
  },
  useDeworming: (...args: unknown[]) => {
    mocks.dewormingHook(...args);
    return {
      data: mocks.dewormingDetail,
      loading: false,
      error: null,
      reload: vi.fn(),
    };
  },
}));

function vaccination(overrides: Partial<VaccinationSummary> = {}): VaccinationSummary {
  return {
    id: ids.vaccination,
    organizationId: ids.organization,
    clinicalEncounterId: ids.encounter,
    patientId: ids.patient,
    status: 'FINALIZED',
    version: 3,
    administeredOn: '2026-01-01',
    nextDueOn: '2026-06-01',
    vaccineName: 'Rabia <script>alert(1)</script>',
    vaccineType: 'Monovalente',
    route: 'Subcutánea',
    laboratoryName: 'Laboratorio QA',
    lotNumber: 'Lote ñ-42',
    expiryOn: '2025-12-31',
    doseText: '1 ml\nrepetir en seis meses',
    notes: 'Nota clínica larga\nsegunda línea',
    createdByMembershipId: ids.membership,
    responsiblePractitionerMembershipId: ids.membership,
    administeredByMembershipId: ids.assistant,
    patientNameSnapshot: 'Luna histórica',
    ownerDisplayNameSnapshot: 'Camila histórica',
    professionalDisplayNameSnapshot: 'Dra. Histórica',
    professionalLicenseSnapshot: 'MV-HIST-001',
    administeredByDisplayNameSnapshot: 'Auxiliar Histórica',
    finalizedAt: '2026-01-02T04:00:00.000Z',
    finalizedByMembershipId: ids.membership,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    createdAt: '2026-01-01T04:00:00.000Z',
    updatedAt: '2026-01-02T04:00:00.000Z',
    parentEncounterStatus: 'FINALIZED',
    patient: { id: ids.patient, name: 'Luna actual', status: 'ACTIVE' },
    encounter: { id: ids.encounter, status: 'FINALIZED' },
    responsiblePractitioner: {
      membershipId: ids.membership,
      displayName: 'Dra. Actual',
      licenseNumber: 'MV-ACTUAL',
      clinicalRole: 'PRACTITIONER',
    },
    administeredBy: {
      membershipId: ids.assistant,
      displayName: 'Auxiliar Actual',
      licenseNumber: null,
      clinicalRole: 'CLINICAL_ASSISTANT',
    },
    ...overrides,
  };
}

function deworming(overrides: Partial<DewormingSummary> = {}): DewormingSummary {
  return {
    id: ids.deworming,
    organizationId: ids.organization,
    clinicalEncounterId: ids.encounter,
    patientId: ids.patient,
    status: 'FINALIZED',
    version: 3,
    administeredOn: '2026-02-01',
    nextDueOn: '2026-08-01',
    productName: 'Pasta antiparasitaria larga',
    dewormingType: 'Interna',
    doseText: '10 mg',
    notes: 'Administrar con alimento.',
    createdByMembershipId: ids.membership,
    responsiblePractitionerMembershipId: ids.membership,
    administeredByMembershipId: null,
    patientNameSnapshot: 'Luna histórica',
    ownerDisplayNameSnapshot: 'Camila histórica',
    professionalDisplayNameSnapshot: 'Dra. Histórica',
    professionalLicenseSnapshot: 'MV-HIST-001',
    administeredByDisplayNameSnapshot: null,
    finalizedAt: '2026-02-02T04:00:00.000Z',
    finalizedByMembershipId: ids.membership,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    createdAt: '2026-02-01T04:00:00.000Z',
    updatedAt: '2026-02-02T04:00:00.000Z',
    parentEncounterStatus: 'FINALIZED',
    patient: { id: ids.patient, name: 'Luna actual', status: 'ACTIVE' },
    encounter: { id: ids.encounter, status: 'FINALIZED' },
    responsiblePractitioner: {
      membershipId: ids.membership,
      displayName: 'Dra. Actual',
      licenseNumber: 'MV-ACTUAL',
      clinicalRole: 'PRACTITIONER',
    },
    administeredBy: null,
    ...overrides,
  };
}

function listState<T>(data: T[]): {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
} {
  return { data, pagination: { page: 1, pageSize: 20, total: data.length, totalPages: 1 } };
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={[`/pacientes/${ids.patient}/historia/preventivos`]}>
      <Routes>
        <Route path="/pacientes/:patientId/historia/preventivos" element={<PreventiveCarePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderVaccinationDetail(routePatientId = ids.patient) {
  return render(
    <MemoryRouter
      initialEntries={[
        `/pacientes/${routePatientId}/historia/preventivos/vacunas/${ids.vaccination}`,
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/preventivos/vacunas/:vaccinationId"
          element={<VaccinationDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDewormingDetail(routePatientId = ids.patient) {
  return render(
    <MemoryRouter
      initialEntries={[
        `/pacientes/${routePatientId}/historia/preventivos/desparasitaciones/${ids.deworming}`,
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/preventivos/desparasitaciones/:dewormingId"
          element={<DewormingDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderVaccinationSection(props: { clinicalEncounterId?: string; compact?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <VaccinationListSection patientId={ids.patient} timezone="America/Bogota" {...props} />
    </MemoryRouter>,
  );
}

function renderDewormingSection(props: { clinicalEncounterId?: string; compact?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <DewormingListSection patientId={ids.patient} timezone="America/Bogota" {...props} />
    </MemoryRouter>,
  );
}

describe('Preventive Care frontend read-only', () => {
  beforeEach(() => {
    mocks.permissions = new Set([
      'vaccinations.read',
      'dewormings.read',
      'clinicalEncounters.read',
      'patients.read',
    ]);
    mocks.vaccinationList = listState([vaccination()]);
    mocks.dewormingList = listState([deworming()]);
    mocks.vaccinationDetail = vaccination();
    mocks.dewormingDetail = deworming();
    mocks.vaccinationsHook.mockClear();
    mocks.dewormingsHook.mockClear();
    mocks.vaccinationHook.mockClear();
    mocks.dewormingHook.mockClear();
  });

  it('1. renders the combined preventive entry when one read permission is available', () => {
    renderLanding();
    expect(screen.getByRole('heading', { name: 'Cuidado preventivo' })).toBeInTheDocument();
  });

  it('2. renders the vaccination section with vaccinations.read', () => {
    mocks.permissions.delete('dewormings.read');
    renderLanding();
    expect(screen.getByRole('heading', { name: 'Vacunación' })).toBeInTheDocument();
  });

  it('3. renders the deworming section with dewormings.read', () => {
    mocks.permissions.delete('vaccinations.read');
    renderLanding();
    expect(screen.getByRole('heading', { name: 'Desparasitación' })).toBeInTheDocument();
  });

  it('4. omits dewormings and does not request them with vaccination-only permission', () => {
    mocks.permissions.delete('dewormings.read');
    renderLanding();
    expect(screen.queryByRole('heading', { name: 'Desparasitación' })).not.toBeInTheDocument();
    expect(mocks.dewormingsHook).not.toHaveBeenCalled();
  });

  it('5. omits vaccinations and does not request them with deworming-only permission', () => {
    mocks.permissions.delete('vaccinations.read');
    renderLanding();
    expect(screen.queryByRole('heading', { name: 'Vacunación' })).not.toBeInTheDocument();
    expect(mocks.vaccinationsHook).not.toHaveBeenCalled();
  });

  it('6. protects the combined route without either permission', () => {
    mocks.permissions.clear();
    renderLanding();
    expect(
      screen.getByRole('heading', { name: 'No tienes permisos para esta acción' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['FINALIZED', 'Finalizado'],
    ['DRAFT', 'Borrador'],
    ['VOIDED', 'Anulado'],
  ] as const)('7. presents vaccination status %s as %s', (status, label) => {
    mocks.vaccinationList = listState([vaccination({ status })]);
    renderLanding();
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  });

  it('8. renders vaccination list data and parent encounter', () => {
    renderVaccinationSection();
    expect(screen.getByLabelText('Vacunaciones')).toBeInTheDocument();
    expect(screen.getByText(/Rabia/)).toBeInTheDocument();
    expect(screen.getByText('Finalizada')).toBeInTheDocument();
  });

  it('9. renders vaccination pagination independently', () => {
    mocks.vaccinationList = {
      ...listState([vaccination()]),
      pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
    };
    renderVaccinationSection();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.vaccinationsHook).toHaveBeenLastCalledWith(ids.patient, { page: 2 }, true);
  });

  it('10. keeps a vaccination DRAFT without administeredOn visible', () => {
    mocks.vaccinationList = listState([
      vaccination({ status: 'DRAFT', administeredOn: null, patientNameSnapshot: null }),
    ]);
    renderLanding();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    expect(screen.getByText(/Sin fecha de aplicación/)).toBeInTheDocument();
    expect(screen.getByText(/Borrador — este registro preventivo/)).toBeInTheDocument();
  });

  it('11. renders vaccination next due date', () => {
    renderLanding();
    expect(screen.getByText('01/06/2026')).toBeInTheDocument();
    expect(screen.getByText('Próxima dosis')).toBeInTheDocument();
  });

  it('12. warns when the vaccination parent encounter is VOIDED', () => {
    mocks.vaccinationList = listState([
      vaccination({ parentEncounterStatus: 'VOIDED', status: 'FINALIZED' }),
    ]);
    renderLanding();
    expect(screen.getByText(/La consulta clínica asociada fue anulada/)).toBeInTheDocument();
  });

  it('13. renders the vaccination empty state without a create CTA', () => {
    mocks.vaccinationList = listState([]);
    renderVaccinationSection();
    expect(
      screen.getByText('Este paciente todavía no tiene registros de vacunación.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar|crear/i })).not.toBeInTheDocument();
  });

  it.each([
    ['vaccineName', 'Rabia <script>alert(1)</script>'],
    ['vaccineType', 'Monovalente'],
    ['route', 'Subcutánea'],
    ['laboratoryName', 'Laboratorio QA'],
    ['lotNumber', 'Lote ñ-42'],
    ['doseText', '1 ml\nrepetir en seis meses'],
  ] as const)('14. renders vaccination %s in detail', (_field, value) => {
    renderVaccinationDetail();
    if (_field === 'doseText') {
      expect(screen.getByText(/1 ml.*repetir en seis meses/)).toBeInTheDocument();
    } else {
      expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    }
  });

  it('15. renders vaccination expiry and notes without rewriting civil dates', () => {
    renderVaccinationDetail();
    expect(screen.getByText('31/12/2025')).toBeInTheDocument();
    expect(screen.getByText(/Nota clínica larga/)).toBeInTheDocument();
  });

  it('16. renders vaccination responsible and administeredBy separately', () => {
    renderVaccinationDetail();
    expect(screen.getByText('Dra. Histórica')).toBeInTheDocument();
    expect(screen.getByText('Auxiliar Histórica')).toBeInTheDocument();
    expect(screen.getByText('Profesional responsable')).toBeInTheDocument();
    expect(screen.getByText('Administrado por')).toBeInTheDocument();
  });

  it('17. renders patient and owner snapshots without replacing them with live names', () => {
    renderVaccinationDetail();
    expect(screen.getByText('Luna histórica')).toBeInTheDocument();
    expect(screen.getByText('Camila histórica')).toBeInTheDocument();
    expect(screen.getByText('Luna actual')).toBeInTheDocument();
    expect(screen.queryByText('Dra. Actual')).not.toBeInTheDocument();
  });

  it('18. renders the vaccination parent Encounter link only with clinical read access', () => {
    renderVaccinationDetail();
    expect(screen.getByRole('link', { name: 'Ver consulta clínica relacionada' })).toHaveAttribute(
      'href',
      `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}`,
    );
    mocks.permissions.delete('clinicalEncounters.read');
    renderVaccinationDetail();
    expect(screen.getAllByText(/disponible para roles autorizados/).length).toBeGreaterThan(0);
  });

  it('19. keeps a FINALIZED vaccination FINALIZED when parent is VOIDED', () => {
    mocks.vaccinationDetail = vaccination({ parentEncounterStatus: 'VOIDED', status: 'FINALIZED' });
    renderVaccinationDetail();
    expect(screen.getAllByText('Finalizado').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/El registro preventivo conserva su estado histórico/),
    ).toBeInTheDocument();
  });

  it('20. presents a VOIDED vaccination reason and timestamp', () => {
    mocks.vaccinationDetail = vaccination({
      status: 'VOIDED',
      voidedAt: '2026-02-03T04:00:00.000Z',
      voidReason: 'Registro duplicado',
    });
    renderVaccinationDetail();
    expect(screen.getAllByText('Anulado').length).toBeGreaterThan(0);
    expect(screen.getByText('Registro duplicado')).toBeInTheDocument();
  });

  it('21. presents a blocked DRAFT when the parent is VOIDED', () => {
    mocks.vaccinationDetail = vaccination({
      status: 'DRAFT',
      parentEncounterStatus: 'VOIDED',
      finalizedAt: null,
      patientNameSnapshot: null,
      ownerDisplayNameSnapshot: null,
      professionalDisplayNameSnapshot: null,
      professionalLicenseSnapshot: null,
    });
    renderVaccinationDetail();
    expect(screen.getByText(/Este borrador no puede continuar/)).toBeInTheDocument();
  });

  it('22. marks an archived patient without offering mutations', () => {
    mocks.vaccinationDetail = vaccination({
      patient: { id: ids.patient, name: 'Luna archivada', status: 'ARCHIVED' },
    });
    renderVaccinationDetail();
    expect(screen.getByText('Paciente archivado')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('23. escapes script-like vaccination text as plain text', () => {
    renderVaccinationDetail();
    expect(screen.getAllByText('Rabia <script>alert(1)</script>').length).toBeGreaterThan(0);
    expect(document.querySelector('script')).not.toBeInTheDocument();
  });

  it('24. keeps vaccination detail free of mutation and commercial controls', () => {
    renderVaccinationDetail();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /Nueva vacunación|Crear vacunación|Editar borrador|Finalizar vacunación|Anular vacunación|PDF|inventario|factura/i,
      ),
    ).not.toBeInTheDocument();
  });

  it('25. treats a mismatched vaccination Patient deep link as not found', () => {
    renderVaccinationDetail(ids.patientSur);
    expect(screen.getByText('Recurso no encontrado')).toBeInTheDocument();
  });

  it('26. formats civil dates with component-only logic', () => {
    expect(formatCivilDate('2026-01-01')).toBe('01/01/2026');
    expect(formatCivilDate('2026-12-31')).toBe('31/12/2026');
    expect(formatCivilDate(null)).toBeNull();
  });

  it.each([
    ['administeredOn', '01/01/2026'],
    ['nextDueOn', '01/06/2026'],
    ['expiryOn', '31/12/2025'],
  ] as const)('27. renders vaccination civil field %s exactly', (_field, value) => {
    renderVaccinationDetail();
    expect(screen.getAllByText(value).length).toBeGreaterThan(0);
    expect(screen.queryByText(`${value}T00:00:00.000Z`)).not.toBeInTheDocument();
  });

  it('28. formats technical timestamps using the organization timezone', () => {
    renderVaccinationDetail();
    expect(screen.getByText(/Finalizado 1\/01\/2026/)).toBeInTheDocument();
  });

  it('29. renders deworming list and product fields', () => {
    renderDewormingSection();
    expect(screen.getByLabelText('Desparasitaciones')).toBeInTheDocument();
    expect(screen.getByText('Pasta antiparasitaria larga')).toBeInTheDocument();
    expect(screen.getByText(/Interna/)).toBeInTheDocument();
  });

  it('30. renders deworming pagination independently', () => {
    mocks.dewormingList = {
      ...listState([deworming()]),
      pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
    };
    renderDewormingSection();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(mocks.dewormingsHook).toHaveBeenLastCalledWith(ids.patient, { page: 2 }, true);
  });

  it('31. presents a deworming DRAFT with no administered date', () => {
    mocks.dewormingList = listState([
      deworming({ status: 'DRAFT', administeredOn: null, patientNameSnapshot: null }),
    ]);
    renderDewormingSection();
    expect(screen.getByText(/Sin fecha de aplicación/)).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
  });

  it('32. renders deworming empty state without a create CTA', () => {
    mocks.dewormingList = listState([]);
    renderDewormingSection();
    expect(
      screen.getByText('Este paciente todavía no tiene registros de desparasitación.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar|crear/i })).not.toBeInTheDocument();
  });

  it('33. renders deworming detail without vaccination-only fields', () => {
    renderDewormingDetail();
    expect(screen.getAllByText('Pasta antiparasitaria larga').length).toBeGreaterThan(0);
    expect(screen.getByText('Interna')).toBeInTheDocument();
    expect(screen.queryByText('Vía')).not.toBeInTheDocument();
    expect(screen.queryByText('Laboratorio')).not.toBeInTheDocument();
    expect(screen.queryByText('Lote')).not.toBeInTheDocument();
    expect(screen.queryByText('Vencimiento del producto')).not.toBeInTheDocument();
  });

  it('34. renders deworming dose, next due and notes', () => {
    renderDewormingDetail();
    expect(screen.getByText('10 mg')).toBeInTheDocument();
    expect(screen.getByText('01/08/2026')).toBeInTheDocument();
    expect(screen.getByText('Administrar con alimento.')).toBeInTheDocument();
  });

  it('35. renders deworming responsible snapshot', () => {
    renderDewormingDetail();
    expect(screen.getByText('Dra. Histórica')).toBeInTheDocument();
    expect(screen.getByText('MV-HIST-001')).toBeInTheDocument();
  });

  it('36. renders deworming parent warning and preserves FINALIZED state', () => {
    mocks.dewormingDetail = deworming({ parentEncounterStatus: 'VOIDED' });
    renderDewormingDetail();
    expect(screen.getAllByText('Finalizado').length).toBeGreaterThan(0);
    expect(screen.getByText(/La consulta clínica asociada fue anulada/)).toBeInTheDocument();
  });

  it('37. renders deworming VOIDED evidence', () => {
    mocks.dewormingDetail = deworming({
      status: 'VOIDED',
      voidedAt: '2026-02-03T04:00:00.000Z',
      voidReason: 'Dosis duplicada',
    });
    renderDewormingDetail();
    expect(screen.getByText('Dosis duplicada')).toBeInTheDocument();
    expect(screen.getAllByText('Anulado').length).toBeGreaterThan(0);
  });

  it('38. renders deworming blocked DRAFT notice for a VOIDED parent', () => {
    mocks.dewormingDetail = deworming({
      status: 'DRAFT',
      parentEncounterStatus: 'VOIDED',
      finalizedAt: null,
      patientNameSnapshot: null,
      ownerDisplayNameSnapshot: null,
      professionalDisplayNameSnapshot: null,
      professionalLicenseSnapshot: null,
    });
    renderDewormingDetail();
    expect(screen.getByText(/Este borrador no puede continuar/)).toBeInTheDocument();
  });

  it('39. keeps deworming detail read-only and script-safe', () => {
    mocks.dewormingDetail = deworming({
      productName: '<script>alert(1)</script>',
      notes: '<script>window.bad=true</script>',
    });
    renderDewormingDetail();
    expect(screen.getAllByText('<script>alert(1)</script>').length).toBeGreaterThan(0);
    expect(screen.getByText('<script>window.bad=true</script>')).toBeInTheDocument();
    expect(document.querySelector('script')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('40. treats a mismatched deworming Patient deep link as not found', () => {
    renderDewormingDetail(ids.patientSur);
    expect(screen.getByText('Recurso no encontrado')).toBeInTheDocument();
  });

  it('41. supports the deworming parent Encounter link', () => {
    renderDewormingDetail();
    expect(screen.getByRole('link', { name: 'Ver consulta clínica relacionada' })).toHaveAttribute(
      'href',
      `/pacientes/${ids.patient}/historia/encuentros/${ids.encounter}`,
    );
  });

  it('42. hides deworming parent link without encounter permission', () => {
    mocks.permissions.delete('clinicalEncounters.read');
    renderDewormingDetail();
    expect(
      screen.queryByRole('link', { name: 'Ver consulta clínica relacionada' }),
    ).not.toBeInTheDocument();
  });

  it('43. marks an archived Patient on deworming detail', () => {
    mocks.dewormingDetail = deworming({
      patient: { id: ids.patient, name: 'Luna archivada', status: 'ARCHIVED' },
    });
    renderDewormingDetail();
    expect(screen.getByText('Paciente archivado')).toBeInTheDocument();
  });

  it('44. uses live responsible and administeredBy names only for DRAFT', () => {
    mocks.vaccinationDetail = vaccination({
      status: 'DRAFT',
      patientNameSnapshot: null,
      ownerDisplayNameSnapshot: null,
      professionalDisplayNameSnapshot: null,
      professionalLicenseSnapshot: null,
      administeredByDisplayNameSnapshot: null,
      responsiblePractitioner: {
        membershipId: ids.membership,
        displayName: 'Dra. Borrador',
        licenseNumber: 'MV-DRAFT',
        clinicalRole: 'PRACTITIONER',
      },
      administeredBy: {
        membershipId: ids.assistant,
        displayName: 'Auxiliar Borrador',
        licenseNumber: null,
        clinicalRole: 'CLINICAL_ASSISTANT',
      },
      finalizedAt: null,
    });
    renderVaccinationDetail();
    expect(screen.getByText('Dra. Borrador')).toBeInTheDocument();
    expect(screen.getByText('Auxiliar Borrador')).toBeInTheDocument();
    expect(screen.queryByText('Dra. Histórica')).not.toBeInTheDocument();
  });

  it('45. shows parent-void warning separately from preventive status', () => {
    mocks.vaccinationDetail = vaccination({ status: 'FINALIZED', parentEncounterStatus: 'VOIDED' });
    renderVaccinationDetail();
    expect(screen.getAllByText('Finalizado').length).toBeGreaterThan(0);
    expect(screen.getByText(/conserva su estado histórico/)).toBeInTheDocument();
  });

  it('46. requests encounter-filtered vaccination data for encounter integration', () => {
    renderVaccinationSection({ clinicalEncounterId: ids.encounter, compact: true });
    expect(mocks.vaccinationsHook).toHaveBeenCalledWith(
      ids.patient,
      { page: 1, clinicalEncounterId: ids.encounter },
      true,
    );
    expect(
      screen.getByRole('heading', { name: 'Vacunaciones de esta consulta' }),
    ).toBeInTheDocument();
  });

  it('47. requests encounter-filtered deworming data for encounter integration', () => {
    renderDewormingSection({ clinicalEncounterId: ids.encounter, compact: true });
    expect(mocks.dewormingsHook).toHaveBeenCalledWith(
      ids.patient,
      { page: 1, clinicalEncounterId: ids.encounter },
      true,
    );
    expect(
      screen.getByRole('heading', { name: 'Desparasitaciones de esta consulta' }),
    ).toBeInTheDocument();
  });

  it('48. preserves an independent deworming empty state when vaccination has data', () => {
    mocks.dewormingList = listState([]);
    renderLanding();
    expect(
      screen.getByText('Este paciente todavía no tiene registros de desparasitación.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Rabia/)).toBeInTheDocument();
  });

  it('49. renders multiple preventive records without assuming one-to-one', () => {
    mocks.vaccinationList = listState([
      vaccination(),
      vaccination({ id: '99999999-9999-4999-8999-999999999999', vaccineName: 'Triple felina' }),
    ]);
    renderVaccinationSection();
    expect(screen.getByText('Triple felina')).toBeInTheDocument();
    expect(screen.getByText('2 registros')).toBeInTheDocument();
  });

  it('50. does not render Patient projection fields', () => {
    renderVaccinationDetail();
    expect(
      screen.queryByText(/lastVaccination|nextVaccination|vaccinationStatus|dewormingStatus/i),
    ).not.toBeInTheDocument();
  });

  it.each([
    ['2026-01-01', '01/01/2026'],
    ['2026-06-01', '01/06/2026'],
    ['2025-12-31', '31/12/2025'],
  ])('51. keeps civil date %s stable as %s', (raw, formatted) => {
    expect(formatCivilDate(raw)).toBe(formatted);
  });

  it('52. keeps long clinical notes as multiline plain text', () => {
    renderVaccinationDetail();
    expect(
      screen.getByText(
        (content) => content.includes('Nota clínica larga') && content.includes('segunda línea'),
      ),
    ).toBeInTheDocument();
  });

  it('53. does not expose a create or edit CTA on the landing page', () => {
    renderLanding();
    expect(
      screen.queryByRole('button', { name: /crear|registrar|editar|finalizar|anular/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
  });

  it('54. uses an accessible heading hierarchy for preventive detail', () => {
    renderVaccinationDetail();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(1);
  });

  it('55. presents the patient archive badge without hiding history', () => {
    mocks.dewormingList = listState([
      deworming({ patient: { id: ids.patient, name: 'Luna archivada', status: 'ARCHIVED' } }),
    ]);
    renderDewormingSection();
    expect(screen.getByText('Paciente archivado')).toBeInTheDocument();
    expect(screen.getAllByText('Pasta antiparasitaria larga').length).toBeGreaterThan(0);
  });

  it('56. keeps list rows as navigable deep links', () => {
    renderVaccinationSection();
    expect(screen.getByRole('link', { name: /Rabia/ })).toHaveAttribute(
      'href',
      `/pacientes/${ids.patient}/historia/preventivos/vacunas/${ids.vaccination}`,
    );
  });

  it('57. exposes the deworming deep link separately from vaccination', () => {
    renderDewormingSection();
    expect(screen.getByRole('link', { name: /Pasta antiparasitaria/ })).toHaveAttribute(
      'href',
      `/pacientes/${ids.patient}/historia/preventivos/desparasitaciones/${ids.deworming}`,
    );
  });

  it('58. keeps a FINALIZED record historical when live profile values differ', () => {
    renderDewormingDetail();
    expect(screen.getByText('Dra. Histórica')).toBeInTheDocument();
    expect(screen.queryByText('Dra. Actual')).not.toBeInTheDocument();
  });

  it('59. renders no empty administeredBy row when it is null', () => {
    renderDewormingDetail();
    expect(screen.queryByText('Administrado por')).not.toBeInTheDocument();
  });

  it('60. renders independent loading-safe sections without a blank page contract', () => {
    mocks.vaccinationList = null;
    mocks.dewormingList = null;
    renderLanding();
    expect(screen.getByRole('heading', { name: 'Cuidado preventivo' })).toBeInTheDocument();
  });
});
