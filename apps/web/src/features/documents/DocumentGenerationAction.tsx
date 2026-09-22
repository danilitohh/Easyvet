import { useState } from 'react';
import type { ClinicalDocumentMetadata, ClinicalDocumentType } from '@veterinary-saas/contracts';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiError } from '../../services/apiClient';
import { errorMessage } from '../shared/resourceUtils';
import { documentsApi } from './documentsApi';

const DOCUMENT_LABEL: Record<Exclude<ClinicalDocumentType, 'CLINICAL_ATTACHMENT'>, string> = {
  PRESCRIPTION: 'Fórmula médica',
  VACCINATION_CERTIFICATE: 'Certificado de vacunación',
  PROCEDURE_REPORT: 'Informe de procedimiento',
  ANESTHESIA_REPORT: 'Informe anestésico',
  HOSPITALIZATION_DISCHARGE: 'Informe de egreso',
  DIAGNOSTIC_RESULT: 'Resultado diagnóstico',
  SIGNED_CONSENT: 'Consentimiento firmado',
};

// Lets a clinician generate or retrieve the immutable artifact for a finalized source version.
export function DocumentGenerationAction({
  documentType,
  sourceId,
  sourceStatus,
}: {
  documentType: Exclude<ClinicalDocumentType, 'CLINICAL_ATTACHMENT'>;
  sourceId: string;
  sourceStatus: string;
}) {
  const canGenerate = useCan(PERMISSION.DOCUMENTS_GENERATE);
  const eligible =
    documentType === 'HOSPITALIZATION_DISCHARGE'
      ? sourceStatus === 'DISCHARGED'
      : documentType === 'DIAGNOSTIC_RESULT'
        ? sourceStatus === 'RESULTED'
        : documentType === 'SIGNED_CONSENT'
          ? sourceStatus === 'SIGNED'
          : sourceStatus === 'FINALIZED';
  const [document, setDocument] = useState<ClinicalDocumentMetadata | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!canGenerate || !eligible || documentType === 'SIGNED_CONSENT') return null;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setDocument(await documentsApi.generate(documentType, sourceId));
    } catch (requestError: unknown) {
      setError(requestError);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    if (!document) return;
    try {
      const blob = await documentsApi.download(document.id);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${DOCUMENT_LABEL[documentType]}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError: unknown) {
      setError(requestError);
    }
  }

  return (
    <Card className="document-generation-card">
      <div>
        <p className="section-kicker">Documento inmutable</p>
        <h2>{DOCUMENT_LABEL[documentType]}</h2>
        <p className="clinical-muted">
          Se genera una sola vez por versión clínica. Las regeneraciones recuperan el mismo archivo
          histórico.
        </p>
      </div>
      {error ? (
        <Alert tone="error" role="alert">
          {error instanceof ApiError && error.code === 'SOURCE_VOIDED'
            ? 'El registro de origen fue anulado. No se puede generar un documento nuevo.'
            : errorMessage(error, 'No fue posible generar el documento.')}
        </Alert>
      ) : null}
      <div className="document-row__actions">
        <Button type="button" disabled={busy} onClick={() => void generate()}>
          {busy ? 'Generando PDF…' : document ? 'Recuperar PDF' : 'Generar PDF'}
        </Button>
        {document ? (
          <Button type="button" variant="secondary" onClick={() => void download()}>
            Descargar
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
