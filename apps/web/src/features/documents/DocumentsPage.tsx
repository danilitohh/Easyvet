import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ClinicalDocumentMetadata } from '@veterinary-saas/contracts';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { errorMessage } from '../shared/resourceUtils';
import { documentsApi } from './documentsApi';
import './documents.css';

const DOCUMENT_LABEL: Record<ClinicalDocumentMetadata['documentType'], string> = {
  PRESCRIPTION: 'Fórmula médica',
  VACCINATION_CERTIFICATE: 'Certificado de vacunación',
  PROCEDURE_REPORT: 'Informe de procedimiento',
  ANESTHESIA_REPORT: 'Informe anestésico',
  HOSPITALIZATION_DISCHARGE: 'Informe de egreso',
  DIAGNOSTIC_RESULT: 'Resultado diagnóstico',
  SIGNED_CONSENT: 'Consentimiento firmado',
  CLINICAL_ATTACHMENT: 'Archivo clínico',
};

// Renders a private, authorized download without exposing storage paths or embedding clinical bytes in the page.
function downloadDocument(document: ClinicalDocumentMetadata, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = document.originalFileName || `${DOCUMENT_LABEL[document.documentType]}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DocumentRow({
  item,
  onDownload,
  onVoid,
  canVoid,
}: {
  item: ClinicalDocumentMetadata;
  onDownload: (item: ClinicalDocumentMetadata) => void;
  onVoid: (item: ClinicalDocumentMetadata) => void;
  canVoid: boolean;
}) {
  return (
    <article className="document-row">
      <div className="document-row__copy">
        <div className="document-row__title">
          <strong>{item.title}</strong>
          <Badge tone={item.status === 'ACTIVE' ? 'success' : 'warning'}>
            {item.status === 'ACTIVE' ? 'Vigente' : 'Anulado'}
          </Badge>
        </div>
        <small>
          {DOCUMENT_LABEL[item.documentType]} ·{' '}
          {item.origin === 'GENERATED' ? 'Generado' : 'Cargado'} ·{' '}
          {new Date(item.createdAt).toLocaleString('es-CO')}
        </small>
        {item.sourceStatus === 'VOIDED' ? (
          <small className="clinical-warning">El registro clínico de origen fue anulado.</small>
        ) : null}
        {item.voidReason ? <small>Motivo de anulación: {item.voidReason}</small> : null}
      </div>
      <div className="document-row__actions">
        <Button type="button" variant="secondary" onClick={() => onDownload(item)}>
          Descargar
        </Button>
        {canVoid && item.status === 'ACTIVE' ? (
          <Button type="button" variant="danger" onClick={() => onVoid(item)}>
            Anular
          </Button>
        ) : null}
      </div>
    </article>
  );
}

// Lists historical artifacts, accepts private PDF/image uploads, and supports reversible clinical voiding.
export function DocumentsPage() {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const { activeMembership } = useAuth();
  const canRead = useCan(PERMISSION.DOCUMENTS_READ);
  const canUpload = useCan(PERMISSION.DOCUMENTS_UPLOAD);
  const canVoid = useCan(PERMISSION.DOCUMENTS_VOID);
  const [items, setItems] = useState<ClinicalDocumentMetadata[]>([]);
  const [itemsOrganizationId, setItemsOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [selectedForVoid, setSelectedForVoid] = useState<ClinicalDocumentMetadata | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<unknown>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  const reload = useCallback(() => setReloadVersion((version) => version + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const organizationId = activeMembership?.organization?.id;
    setItems([]);
    setItemsOrganizationId(null);
    setError(null);
    if (!organizationId || !canRead || !patientId) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    void documentsApi
      .list(patientId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result);
          setItemsOrganizationId(organizationId);
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(requestError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [activeMembership?.organization?.id, canRead, patientId, reloadVersion]);

  useEffect(() => {
    setTitle('');
    setFile(null);
    setSelectedForVoid(null);
    setVoidReason('');
  }, [activeMembership?.organization?.id]);

  const visibleItems = itemsOrganizationId === activeMembership?.organization?.id ? items : [];

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !title.trim()) return;
    setSaving(true);
    setUploadError(null);
    try {
      await documentsApi.upload(patientId, title.trim(), file);
      setTitle('');
      setFile(null);
      const input = window.document.getElementById('document-file') as HTMLInputElement | null;
      if (input) input.value = '';
      await reload();
    } catch (requestError: unknown) {
      setUploadError(requestError);
    } finally {
      setSaving(false);
    }
  }

  async function download(item: ClinicalDocumentMetadata) {
    try {
      downloadDocument(item, await documentsApi.download(item.id));
    } catch (requestError: unknown) {
      setError(requestError);
    }
  }

  async function voidSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedForVoid || !voidReason.trim()) return;
    setSaving(true);
    setVoidError(null);
    try {
      await documentsApi.void(selectedForVoid.id, voidReason.trim());
      setSelectedForVoid(null);
      setVoidReason('');
      await reload();
    } catch (requestError: unknown) {
      setVoidError(requestError);
    } finally {
      setSaving(false);
    }
  }

  if (!canRead) {
    return (
      <section className="page-stack clinical-page">
        <PageHeader
          eyebrow="Historia clínica"
          title="Documentos"
          description="No tienes permiso para consultar documentos clínicos."
        />
      </section>
    );
  }

  return (
    <section className="page-stack clinical-page documents-page">
      <PageHeader
        eyebrow="Historia clínica · Archivos"
        title="Documentos clínicos"
        description="Archivos y documentos inmutables relacionados con la atención de este paciente."
        action={
          <Link className="button button--secondary" to={`/pacientes/${patientId}/historia`}>
            Volver a historia
          </Link>
        }
      />
      {error ? (
        <Alert tone="error" role="alert">
          {errorMessage(error, 'No fue posible cargar el documento solicitado.')}
          <Button type="button" variant="secondary" onClick={() => void reload()}>
            Reintentar
          </Button>
        </Alert>
      ) : null}
      {canUpload ? (
        <Card>
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Adjuntar archivo</p>
              <h2>Subir documento existente</h2>
            </div>
            <Badge>PDF · PNG · JPEG · 10 MB máx.</Badge>
          </div>
          <form className="document-upload" onSubmit={(event) => void upload(event)}>
            <FormField label="Nombre del documento *" htmlFor="document-title">
              <TextInput
                id="document-title"
                value={title}
                maxLength={300}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </FormField>
            <FormField
              label="Archivo *"
              htmlFor="document-file"
              hint="El archivo se almacena de forma privada."
            >
              <input
                className="input document-upload__file"
                id="document-file"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </FormField>
            {uploadError ? (
              <Alert tone="error" role="alert">
                {errorMessage(uploadError, 'No fue posible cargar el archivo.')}
              </Alert>
            ) : null}
            <Button type="submit" disabled={saving || !file || !title.trim()}>
              {saving ? 'Subiendo…' : 'Subir archivo'}
            </Button>
          </form>
        </Card>
      ) : null}
      <Card className="document-list">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Archivo clínico</p>
            <h2>Documentos</h2>
          </div>
          <Badge>{`${visibleItems.length} registros`}</Badge>
        </div>
        {loading ? (
          <LoadingState label="Cargando documentos" />
        ) : visibleItems.length ? (
          <div className="document-list__rows">
            {visibleItems.map((item) => (
              <DocumentRow
                key={item.id}
                item={item}
                onDownload={(document) => void download(document)}
                onVoid={setSelectedForVoid}
                canVoid={canVoid}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Todavía no hay documentos"
            description="Los documentos generados y archivos cargados aparecerán aquí como historial del paciente."
          />
        )}
      </Card>
      <Modal
        open={Boolean(selectedForVoid)}
        title="Anular documento"
        description="El archivo se conservará y seguirá disponible para consulta autorizada. No se eliminará físicamente."
        onClose={() => setSelectedForVoid(null)}
      >
        <form className="domain-form" onSubmit={(event) => void voidSelected(event)}>
          <FormField label="Motivo de anulación *" htmlFor="document-void-reason">
            <textarea
              id="document-void-reason"
              className="input input--textarea"
              value={voidReason}
              maxLength={1000}
              onChange={(event) => setVoidReason(event.target.value)}
              required
            />
          </FormField>
          {voidError ? (
            <Alert tone="error" role="alert">
              {errorMessage(voidError, 'No fue posible anular el documento.')}
            </Alert>
          ) : null}
          <Button type="submit" variant="danger" disabled={saving || !voidReason.trim()}>
            Confirmar anulación
          </Button>
        </form>
      </Modal>
    </section>
  );
}
