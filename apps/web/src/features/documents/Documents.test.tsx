import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ClinicalDocumentMetadata,
  ConsentDetail,
  PublicConsent,
} from '@veterinary-saas/contracts';
import { DocumentsPage } from './DocumentsPage';
import { ConsentDetailPage } from './ConsentDetailPage';
import { ConsentFormPage } from './ConsentFormPage';
import { PublicSignaturePage } from './PublicSignaturePage';
import { findUnlabeledFormControls, findUnnamedActions } from '../../test/accessibility';

const ids = vi.hoisted(() => ({
  organization: '10000000-0000-4000-8000-000000000001',
  patient: '10000000-0000-4000-8000-000000000002',
  membership: '10000000-0000-4000-8000-000000000003',
  consent: '10000000-0000-4000-8000-000000000004',
  document: '10000000-0000-4000-8000-000000000005',
}));

const mocks = vi.hoisted(() => ({
  permissions: new Set<string>(),
  consent: null as ConsentDetail | null,
  documents: [] as ClinicalDocumentMetadata[],
  publicConsent: null as PublicConsent | null,
  issueResponse: null as {
    consent: ConsentDetail;
    signingPath: string;
    verificationCode: string;
    expiresAt: string;
  } | null,
  list: vi.fn(),
  upload: vi.fn(),
  voidDocument: vi.fn(),
  download: vi.fn(),
  loadConsent: vi.fn(),
  issue: vi.fn(),
  publicLoad: vi.fn(),
  publicSign: vi.fn(),
  createConsent: vi.fn(),
  updateConsent: vi.fn(),
  reissue: vi.fn(),
}));

vi.mock('../../auth/useCan', () => ({
  useCan: (permission: string) => mocks.permissions.has(permission),
}));

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    activeMembership: { id: ids.membership, organization: { id: ids.organization } },
  }),
}));

vi.mock('../clinical/useClinical', () => ({
  useClinicalPractitioners: () => ({
    data: { data: [] },
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('./documentsApi', () => ({
  documentsApi: {
    list: mocks.list,
    upload: mocks.upload,
    void: mocks.voidDocument,
    download: mocks.download,
    consent: mocks.loadConsent,
    issue: mocks.issue,
    reissue: mocks.reissue,
    createConsent: mocks.createConsent,
    updateConsent: mocks.updateConsent,
    publicConsent: mocks.publicLoad,
    signPublic: mocks.publicSign,
  },
}));

function metadata(overrides: Partial<ClinicalDocumentMetadata> = {}): ClinicalDocumentMetadata {
  return {
    id: ids.document,
    patientId: ids.patient,
    clinicalEncounterId: null,
    origin: 'UPLOADED',
    status: 'ACTIVE',
    documentType: 'CLINICAL_ATTACHMENT',
    title: 'Resumen de laboratorio',
    originalFileName: 'laboratorio.pdf',
    sourceType: null,
    sourceId: null,
    sourceVersion: null,
    mimeType: 'application/pdf',
    sizeBytes: 18,
    sha256: 'a'.repeat(64),
    voidReason: null,
    voidedAt: null,
    createdAt: '2035-01-08T15:00:00.000Z',
    ...overrides,
  };
}

function consent(overrides: Partial<ConsentDetail> = {}): ConsentDetail {
  return {
    id: ids.consent,
    organizationId: ids.organization,
    patientId: ids.patient,
    clinicalEncounterId: '10000000-0000-4000-8000-000000000006',
    clinicalProcedureId: null,
    status: 'DRAFT',
    version: 2,
    title: 'Consentimiento de procedimiento',
    purposeText: 'Explica el propósito',
    risksText: 'Riesgos posibles',
    benefitsText: null,
    alternativesText: null,
    estimatedCostText: null,
    declarationText: 'Acepto el procedimiento informado.',
    responsiblePractitionerMembershipId: ids.membership,
    patientNameSnapshot: null,
    ownerDisplayNameSnapshot: null,
    ownerDocumentTypeSnapshot: null,
    ownerDocumentNumberSnapshot: null,
    professionalDisplayNameSnapshot: null,
    professionalLicenseSnapshot: null,
    contentSha256: null,
    issuedAt: null,
    signedAt: null,
    voidedAt: null,
    voidReason: null,
    createdAt: '2035-01-08T15:00:00.000Z',
    updatedAt: '2035-01-08T15:00:00.000Z',
    encounterStatus: 'DRAFT',
    procedureStatus: null,
    patientStatus: 'ACTIVE',
    signerName: null,
    signatureMethod: null,
    signedDocumentId: null,
    ...overrides,
  };
}

function renderDocuments() {
  return render(
    <MemoryRouter initialEntries={[`/pacientes/${ids.patient}/historia/documentos`]}>
      <Routes>
        <Route path="/pacientes/:patientId/historia/documentos" element={<DocumentsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderConsentDetail() {
  return render(
    <MemoryRouter
      initialEntries={[`/pacientes/${ids.patient}/historia/consentimientos/${ids.consent}`]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/consentimientos/:consentId"
          element={<ConsentDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderConsentForm() {
  return render(
    <MemoryRouter
      initialEntries={[
        `/pacientes/${ids.patient}/historia/encuentros/${ids.consent}/consentimientos/nuevo`,
      ]}
    >
      <Routes>
        <Route
          path="/pacientes/:patientId/historia/encuentros/:encounterId/consentimientos/nuevo"
          element={<ConsentFormPage mode="create" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderPublicSignature() {
  return render(
    <MemoryRouter
      initialEntries={['/firmar/aValidSignatureTokenThatIsNotRealButLongEnoughToTest123']}
    >
      <Routes>
        <Route path="/firmar/:token" element={<PublicSignaturePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  ids.organization = '10000000-0000-4000-8000-000000000001';
  mocks.permissions = new Set([
    'documents.read',
    'documents.upload',
    'documents.void',
    'documents.generate',
    'consents.read',
    'consents.issue',
    'consents.updateDraft',
    'consents.void',
  ]);
  mocks.documents = [metadata()];
  mocks.consent = consent();
  mocks.issueResponse = {
    consent: consent({
      status: 'ISSUED',
      version: 3,
      contentSha256: 'b'.repeat(64),
      issuedAt: '2035-01-08T15:00:00.000Z',
    }),
    signingPath: '/firmar/fictitious-token',
    verificationCode: '004281',
    expiresAt: '2035-01-11T15:00:00.000Z',
  };
  mocks.publicConsent = {
    organizationDisplayName: 'Clínica Norte',
    patientName: 'Luna',
    ownerDisplayName: 'Camila Rojas',
    ownerDocumentMasked: '***1234',
    title: 'Consentimiento de procedimiento',
    purposeText: 'Explica el propósito',
    risksText: 'Riesgos posibles',
    benefitsText: null,
    alternativesText: null,
    estimatedCostText: null,
    declarationText: 'Acepto el procedimiento informado.',
    professionalDisplayName: 'Dra. Andrea Pérez',
    professionalLicense: 'MV-100',
    expiresAt: '2035-01-11T15:00:00.000Z',
  };
  mocks.list.mockReset().mockImplementation(async () => mocks.documents);
  mocks.upload
    .mockReset()
    .mockResolvedValue(metadata({ id: '10000000-0000-4000-8000-000000000009' }));
  mocks.voidDocument
    .mockReset()
    .mockResolvedValue(metadata({ status: 'VOIDED', voidReason: 'Duplicado' }));
  mocks.download.mockReset().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  mocks.loadConsent.mockReset().mockImplementation(async () => mocks.consent);
  mocks.issue.mockReset().mockImplementation(async () => mocks.issueResponse);
  mocks.reissue.mockReset().mockImplementation(async () => mocks.issueResponse);
  mocks.createConsent.mockReset().mockImplementation(async () => consent());
  mocks.updateConsent.mockReset().mockImplementation(async () => consent());
  mocks.publicLoad.mockReset().mockImplementation(async () => mocks.publicConsent);
  mocks.publicSign.mockReset().mockResolvedValue({
    signerName: 'Camila Rojas',
    signedAt: '2035-01-08T15:00:00.000Z',
    signatureMethod: 'TYPED',
  });
});

describe('documents and consent frontend', () => {
  it('keeps the consent form controls and actions accessible', () => {
    const { container } = renderConsentForm();

    expect(findUnlabeledFormControls(container)).toEqual([]);
    expect(findUnnamedActions(container)).toEqual([]);
  });

  it('lists and uploads a PDF through the private multipart flow', async () => {
    renderDocuments();

    expect(await screen.findByText('Resumen de laboratorio')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre del documento *'), {
      target: { value: 'Resultado ficticio' },
    });
    const file = new File(['%PDF-1.7 fictitious'], 'resultado.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Archivo *'), { target: { files: [file] } });
    fireEvent.submit(screen.getByRole('button', { name: 'Subir archivo' }).closest('form')!);

    await waitFor(() =>
      expect(mocks.upload).toHaveBeenCalledWith(ids.patient, 'Resultado ficticio', file),
    );
    expect(mocks.list).toHaveBeenCalled();
  });

  it('keeps one-time signature link/code visible only until the issue dialog is closed', async () => {
    renderConsentDetail();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Emitir y crear solicitud de firma' }),
    );
    expect(await screen.findByLabelText('Código de verificación (una sola vez)')).toHaveValue(
      '004281',
    );
    expect(screen.getByLabelText('Enlace de firma')).toHaveValue(
      `${window.location.origin}/firmar/fictitious-token`,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Listo, cerrar' }));
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Código de verificación (una sola vez)'),
      ).not.toBeInTheDocument(),
    );
  });

  it('allows saving a genuinely incomplete draft before issue-time validation', async () => {
    mocks.permissions.add('consents.create');
    renderConsentForm();

    expect(screen.getByLabelText('Título')).not.toBeRequired();
    expect(screen.getByLabelText('Declaración de aceptación')).not.toBeRequired();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));

    await waitFor(() =>
      expect(mocks.createConsent).toHaveBeenCalledWith(
        ids.patient,
        ids.consent,
        expect.objectContaining({ title: '', declarationText: null }),
      ),
    );
  });

  it('can reissue a request and presents the new one-time code and link', async () => {
    mocks.consent = consent({
      status: 'ISSUED',
      version: 3,
      contentSha256: 'b'.repeat(64),
      issuedAt: '2035-01-08T15:00:00.000Z',
    });
    mocks.reissue.mockResolvedValue({
      ...mocks.issueResponse,
      consent: consent({ status: 'ISSUED', version: 4, contentSha256: 'b'.repeat(64) }),
      signingPath: '/firmar/new-fictitious-token',
      verificationCode: '002419',
    });
    renderConsentDetail();

    fireEvent.click(await screen.findByRole('button', { name: 'Reemitir enlace de firma' }));

    expect(mocks.reissue).toHaveBeenCalledWith(ids.consent, 3);
    expect(await screen.findByLabelText('Código de verificación (una sola vez)')).toHaveValue(
      '002419',
    );
    expect(screen.getByLabelText('Enlace de firma')).toHaveValue(
      `${window.location.origin}/firmar/new-fictitious-token`,
    );
  });

  it('renders signed evidence read-only with a private signed-PDF action', async () => {
    mocks.consent = consent({
      status: 'SIGNED',
      version: 4,
      contentSha256: 'c'.repeat(64),
      patientNameSnapshot: 'Luna histórica',
      signerName: 'Camila Rojas',
      signatureMethod: 'TYPED',
      signedAt: '2035-01-08T15:00:00.000Z',
      signedDocumentId: ids.document,
    });
    renderConsentDetail();

    expect(await screen.findByRole('heading', { name: 'Firmado' })).toBeInTheDocument();
    expect(
      screen.getByText(/Consentimiento firmado por Camila Rojas mediante TYPED/),
    ).toBeVisible();
    expect(screen.getByText('Luna histórica')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Descargar PDF firmado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar borrador' })).not.toBeInTheDocument();
  });

  it('keeps old-tenant document metadata hidden while the new tenant request is pending or fails', async () => {
    const { rerender } = renderDocuments();
    expect(await screen.findByText('Resumen de laboratorio')).toBeInTheDocument();
    ids.organization = '10000000-0000-4000-8000-000000000099';
    mocks.list.mockRejectedValueOnce(new Error('forbidden tenant response'));
    rerender(
      <MemoryRouter initialEntries={[`/pacientes/${ids.patient}/historia/documentos`]}>
        <Routes>
          <Route path="/pacientes/:patientId/historia/documentos" element={<DocumentsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.queryByText('Resumen de laboratorio')).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole('alert')).not.toHaveTextContent('forbidden tenant response');
  });

  it('signs through the typed public fallback without exposing clinical identifiers', async () => {
    renderPublicSignature();

    expect(
      await screen.findByRole('heading', { name: 'Consentimiento de procedimiento' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Clínica Norte')).toBeInTheDocument();
    expect(screen.queryByText(ids.patient)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Código de verificación de 6 dígitos *'), {
      target: { value: '004281' },
    });
    fireEvent.change(screen.getByLabelText('Nombre completo de quien acepta *'), {
      target: { value: 'Camila Rojas' },
    });
    fireEvent.click(screen.getByLabelText('He leído el consentimiento y acepto su contenido.'));
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }));

    expect(await screen.findByText('Consentimiento firmado correctamente.')).toBeInTheDocument();
    expect(mocks.publicSign).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signatureMethod: 'TYPED', verificationCode: '004281' }),
    );
  });

  it('supports a drawn signature using a PNG blob while keeping the typed option available', async () => {
    const drawing = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      drawing as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 320,
      bottom: 140,
      width: 320,
      height: 140,
      toJSON: () => ({}),
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['png'], { type: 'image/png' })),
    );
    renderPublicSignature();

    fireEvent.click(await screen.findByLabelText('Firma manuscrita'));
    const canvas = screen.getByRole('img', { name: /área de firma manuscrita/i });
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 30, clientY: 40 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 30, clientY: 40 });
    fireEvent.change(screen.getByLabelText('Código de verificación de 6 dígitos *'), {
      target: { value: '004281' },
    });
    fireEvent.change(screen.getByLabelText('Nombre completo de quien acepta *'), {
      target: { value: 'Camila Rojas' },
    });
    fireEvent.click(screen.getByLabelText('He leído el consentimiento y acepto su contenido.'));
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y aceptar' }));

    expect(await screen.findByText('Consentimiento firmado correctamente.')).toBeInTheDocument();
    expect(mocks.publicSign).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signatureMethod: 'DRAWN', signature: expect.any(Blob) }),
    );
  });

  it('shows a generic unavailable state when the public signature token is invalid', async () => {
    mocks.publicLoad.mockRejectedValueOnce(new Error('database secret must not be rendered'));
    renderPublicSignature();

    expect(
      await screen.findByRole('heading', { name: 'Enlace de firma no disponible' }),
    ).toBeVisible();
    expect(screen.queryByText('database secret must not be rendered')).not.toBeInTheDocument();
  });
});
