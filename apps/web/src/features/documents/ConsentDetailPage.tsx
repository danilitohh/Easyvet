import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ConsentDetail } from '@veterinary-saas/contracts';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';
import { documentsApi } from './documentsApi';
import './documents.css';

const CONTENT_FIELDS: Array<{ key: keyof ConsentDetail; label: string }> = [
  { key: 'purposeText', label: 'Propósito' },
  { key: 'risksText', label: 'Riesgos' },
  { key: 'benefitsText', label: 'Beneficios' },
  { key: 'alternativesText', label: 'Alternativas' },
  { key: 'estimatedCostText', label: 'Costo estimado' },
  { key: 'declarationText', label: 'Declaración' },
];

// Displays single-use link and code in memory only; closing the dialog discards both plaintext secrets.
function OneTimeIssueDialog({
  issue,
  onClose,
}: {
  issue: { signingPath: string; verificationCode: string; expiresAt: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const link = issue ? `${window.location.origin}${issue.signingPath}` : '';
  async function copy(value: string, kind: 'link' | 'code') {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
    } catch {
      setCopied(null);
    }
  }
  return (
    <Modal
      open={Boolean(issue)}
      title="Solicitud de firma lista"
      description="Copia ahora el enlace y el código. El código no volverá a mostrarse y no se guarda en el navegador."
      onClose={onClose}
    >
      {issue ? (
        <div className="one-time-secrets">
          <Alert tone="warning" role="status">
            Comparte el enlace y el código únicamente con la persona responsable. No cierres esta
            ventana hasta copiarlos.
          </Alert>
          <FormField label="Enlace de firma" htmlFor="signature-link">
            <div className="copy-field">
              <TextInput id="signature-link" value={link} readOnly />
              <Button type="button" variant="secondary" onClick={() => void copy(link, 'link')}>
                {copied === 'link' ? 'Copiado' : 'Copiar enlace'}
              </Button>
            </div>
          </FormField>
          <FormField label="Código de verificación (una sola vez)" htmlFor="signature-code">
            <div className="copy-field">
              <TextInput id="signature-code" value={issue.verificationCode} readOnly />
              <Button
                type="button"
                variant="secondary"
                onClick={() => void copy(issue.verificationCode, 'code')}
              >
                {copied === 'code' ? 'Copiado' : 'Copiar código'}
              </Button>
            </div>
          </FormField>
          <p className="clinical-muted">
            Vence {new Date(issue.expiresAt).toLocaleString('es-CO')}.
          </p>
          <Button type="button" onClick={onClose}>
            Listo, cerrar
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}

// Consent detail enforces UI state rules while the API remains authoritative for CAS and race safety.
export function ConsentDetailPage() {
  const { patientId = '', consentId = '' } = useParams<{ patientId: string; consentId: string }>();
  const { activeMembership } = useAuth();
  const organizationId = activeMembership?.organization?.id;
  const organizationIdRef = useRef(organizationId);
  organizationIdRef.current = organizationId;
  const canRead = useCan(PERMISSION.CONSENTS_READ);
  const canEdit = useCan(PERMISSION.CONSENTS_UPDATE_DRAFT);
  const canIssue = useCan(PERMISSION.CONSENTS_ISSUE);
  const canVoid = useCan(PERMISSION.CONSENTS_VOID);
  const canReadDocuments = useCan(PERMISSION.DOCUMENTS_READ);
  const [consent, setConsent] = useState<ConsentDetail | null>(null);
  const [consentOrganizationId, setConsentOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [issueSecrets, setIssueSecrets] = useState<{
    signingPath: string;
    verificationCode: string;
    expiresAt: string;
  } | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<unknown>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  const reload = useCallback(() => setReloadVersion((version) => version + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setConsent(null);
    setConsentOrganizationId(null);
    setIssueSecrets(null);
    setError(null);
    setVoidError(null);
    setVoidOpen(false);
    setVoidReason('');
    setBusy(false);
    if (!organizationId) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    void documentsApi
      .consent(consentId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setConsent(result);
          setConsentOrganizationId(organizationId);
        }
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(requestError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [consentId, organizationId, reloadVersion]);

  async function issue(reissue = false) {
    if (!consent) return;
    const issuingOrganizationId = organizationId;
    setBusy(true);
    setError(null);
    try {
      const result = reissue
        ? await documentsApi.reissue(consent.id, consent.version)
        : await documentsApi.issue(consent.id, consent.version);
      if (organizationIdRef.current !== issuingOrganizationId) return;
      setConsent(result.consent);
      setIssueSecrets({
        signingPath: result.signingPath,
        verificationCode: result.verificationCode,
        expiresAt: result.expiresAt,
      });
    } catch (requestError: unknown) {
      if (organizationIdRef.current === issuingOrganizationId) setError(requestError);
    } finally {
      if (organizationIdRef.current === issuingOrganizationId) setBusy(false);
    }
  }

  async function voidConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || !voidReason.trim()) return;
    const voidingOrganizationId = organizationId;
    setBusy(true);
    setVoidError(null);
    try {
      const result = await documentsApi.voidConsent(consent.id, consent.version, voidReason.trim());
      if (organizationIdRef.current !== voidingOrganizationId) return;
      setConsent(result);
      setVoidOpen(false);
      setVoidReason('');
    } catch (requestError: unknown) {
      if (organizationIdRef.current === voidingOrganizationId) setVoidError(requestError);
    } finally {
      if (organizationIdRef.current === voidingOrganizationId) setBusy(false);
    }
  }

  async function downloadSignedPdf() {
    if (!consent?.signedDocumentId) return;
    const downloadingOrganizationId = organizationId;
    try {
      const blob = await documentsApi.download(consent.signedDocumentId);
      if (organizationIdRef.current !== downloadingOrganizationId) return;
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `consentimiento-firmado-${consent.id}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError: unknown) {
      if (organizationIdRef.current === downloadingOrganizationId) setError(requestError);
    }
  }

  if (loading)
    return (
      <div className="page-stack">
        <LoadingState label="Cargando consentimiento" />
      </div>
    );
  if (!canRead || !consent || consentOrganizationId !== organizationId)
    return (
      <section className="page-stack clinical-page">
        <Alert tone="error" role="alert">
          {error
            ? errorMessage(error, 'No fue posible cargar el consentimiento.')
            : 'No tienes permiso para consultar este consentimiento.'}
        </Alert>
        <Button
          as={Link}
          to={`/pacientes/${patientId}/historia/consentimientos`}
          variant="secondary"
        >
          Volver
        </Button>
      </section>
    );

  const responsibleActor = activeMembership?.id === consent.responsiblePractitionerMembershipId;
  const parentUnavailable =
    consent.encounterStatus === 'VOIDED' || consent.procedureStatus === 'VOIDED';
  const canIssueNow =
    canIssue &&
    responsibleActor &&
    consent.status === 'DRAFT' &&
    !parentUnavailable &&
    consent.patientStatus === 'ACTIVE';
  const canReissueNow =
    canIssue &&
    consent.status === 'ISSUED' &&
    !parentUnavailable &&
    consent.patientStatus === 'ACTIVE';
  const canVoidNow = canVoid && (consent.status === 'ISSUED' || consent.status === 'SIGNED');

  return (
    <section className="page-stack clinical-page documents-page">
      <PageHeader
        eyebrow="Historia clínica · Consentimiento"
        title={consent.title || 'Consentimiento sin título'}
        description={`Versión ${consent.version} · ${consent.status === 'DRAFT' ? 'Borrador editable' : 'Contenido congelado desde su emisión'}`}
        action={
          <Link
            className="button button--secondary"
            to={`/pacientes/${patientId}/historia/consentimientos`}
          >
            Volver a consentimientos
          </Link>
        }
      />
      {error ? (
        <Alert tone="error" role="alert">
          {errorMessage(error, 'No fue posible completar la operación.')}
          {error instanceof ApiError && error.status === 409 ? (
            <Button type="button" variant="secondary" onClick={() => void reload()}>
              Recargar versión actual
            </Button>
          ) : null}
        </Alert>
      ) : null}
      {consent.status === 'DRAFT' ? (
        <Alert tone="info" role="status">
          Borrador: el documento puede estar incompleto. Al emitir se guardará una versión
          inmutable.
        </Alert>
      ) : null}
      {parentUnavailable ? (
        <Alert tone="warning" role="status">
          El encuentro o procedimiento relacionado está anulado. Este consentimiento no puede
          emitirse ni firmarse. No se anula automáticamente.
        </Alert>
      ) : null}
      {consent.patientStatus === 'ARCHIVED' ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. Se conserva el historial y se permite anular un consentimiento
          emitido, pero no editar, emitir ni firmar.
        </Alert>
      ) : null}
      <Card className="consent-status-card">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Estado</p>
            <h2>
              {consent.status === 'DRAFT'
                ? 'Borrador'
                : consent.status === 'ISSUED'
                  ? 'Pendiente de firma'
                  : consent.status === 'SIGNED'
                    ? 'Firmado'
                    : 'Anulado'}
            </h2>
          </div>
          <Badge
            tone={
              consent.status === 'SIGNED'
                ? 'success'
                : consent.status === 'VOIDED'
                  ? 'warning'
                  : 'info'
            }
          >
            {consent.status}
          </Badge>
        </div>
        <dl className="consent-meta">
          <div>
            <dt>Paciente</dt>
            <dd>{consent.patientNameSnapshot ?? 'Se fijará al emitir'}</dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>{consent.ownerDisplayNameSnapshot ?? 'Se fijará al emitir'}</dd>
          </div>
          <div>
            <dt>Profesional</dt>
            <dd>{consent.professionalDisplayNameSnapshot ?? 'Pendiente de asignación'}</dd>
          </div>
          <div>
            <dt>Emitido</dt>
            <dd>
              {consent.issuedAt ? new Date(consent.issuedAt).toLocaleString('es-CO') : 'Todavía no'}
            </dd>
          </div>
          <div>
            <dt>Firmado</dt>
            <dd>
              {consent.signedAt ? new Date(consent.signedAt).toLocaleString('es-CO') : 'Pendiente'}
            </dd>
          </div>
        </dl>
      </Card>
      <Card>
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Contenido</p>
            <h2>Información del consentimiento</h2>
          </div>
        </div>
        <dl className="clinical-fields consent-content">
          {CONTENT_FIELDS.map(({ key, label }) => {
            const value = consent[key];
            return typeof value === 'string' && value.trim() ? (
              <div className="clinical-field" key={key}>
                <dt>{label}</dt>
                <dd className="clinical-prose">{value}</dd>
              </div>
            ) : null;
          })}
        </dl>
        {consent.contentSha256 ? (
          <p className="clinical-muted">
            Huella de contenido: <code>{consent.contentSha256.slice(0, 16)}…</code>
          </p>
        ) : null}
        {consent.status === 'SIGNED' ? (
          <Alert tone="success" role="status">
            Consentimiento firmado por {consent.signerName ?? 'el firmante'} mediante{' '}
            {consent.signatureMethod ?? 'aceptación electrónica'}.
          </Alert>
        ) : null}
        {consent.status === 'VOIDED' ? (
          <Alert tone="warning" role="status">
            Consentimiento anulado el{' '}
            {consent.voidedAt ? new Date(consent.voidedAt).toLocaleString('es-CO') : '—'}. Motivo:{' '}
            {consent.voidReason}
          </Alert>
        ) : null}
      </Card>
      <Card className="consent-actions">
        <div className="detail-card__heading">
          <div>
            <p className="section-kicker">Operaciones disponibles</p>
            <h2>Acciones</h2>
          </div>
        </div>
        <div className="document-row__actions">
          {consent.status === 'DRAFT' && canEdit ? (
            <Button
              as={Link}
              to={`/pacientes/${patientId}/historia/consentimientos/${consent.id}/editar`}
              variant="secondary"
            >
              Editar borrador
            </Button>
          ) : null}
          {canIssueNow ? (
            <Button type="button" disabled={busy} onClick={() => void issue()}>
              {busy ? 'Emitiendo…' : 'Emitir y crear solicitud de firma'}
            </Button>
          ) : null}
          {canReissueNow ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void issue(true)}
            >
              {busy ? 'Creando solicitud…' : 'Reemitir enlace de firma'}
            </Button>
          ) : null}
          {consent.status === 'SIGNED' && canReadDocuments && consent.signedDocumentId ? (
            <Button type="button" variant="secondary" onClick={() => void downloadSignedPdf()}>
              Descargar PDF firmado
            </Button>
          ) : null}
          {canVoidNow ? (
            <Button type="button" variant="danger" onClick={() => setVoidOpen(true)}>
              Anular consentimiento
            </Button>
          ) : null}
          {!responsibleActor && consent.status === 'DRAFT' && canIssue ? (
            <p className="clinical-muted">
              Solo el profesional responsable asignado puede emitir este consentimiento.
            </p>
          ) : null}
          {consent.status === 'ISSUED' && !canReissueNow ? (
            <p className="clinical-muted">
              La solicitud no puede reemitirse mientras el paciente o su contexto clínico no estén
              activos.
            </p>
          ) : null}
        </div>
        <p className="clinical-muted">
          Easyvet registra evidencia de aceptación electrónica; no es una firma digital certificada.
          Revisa los requisitos legales aplicables a tu jurisdicción.
        </p>
      </Card>
      <OneTimeIssueDialog issue={issueSecrets} onClose={() => setIssueSecrets(null)} />
      <Modal
        open={voidOpen}
        title="Anular consentimiento"
        description="El consentimiento, la solicitud de firma y los archivos de evidencia se conservan como historial."
        onClose={() => setVoidOpen(false)}
      >
        <form className="domain-form" onSubmit={(event) => void voidConsent(event)}>
          <FormField label="Motivo de anulación *" htmlFor="consent-void-reason">
            <textarea
              id="consent-void-reason"
              className="input input--textarea"
              value={voidReason}
              maxLength={1000}
              onChange={(event) => setVoidReason(event.target.value)}
              required
            />
          </FormField>
          {voidError ? (
            <Alert tone="error" role="alert">
              {errorMessage(voidError, 'No fue posible anular el consentimiento.')}
            </Alert>
          ) : null}
          <Button type="submit" variant="danger" disabled={busy || !voidReason.trim()}>
            {busy ? 'Anulando…' : 'Confirmar anulación'}
          </Button>
        </form>
      </Modal>
    </section>
  );
}
