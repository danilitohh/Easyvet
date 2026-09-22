import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ConsentDetail } from '@veterinary-saas/contracts';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';
import { useAuth } from '../../contexts/useAuth';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { errorMessage } from '../shared/resourceUtils';
import { documentsApi } from './documentsApi';
import './documents.css';

const CONSENT_STATUS: Record<ConsentDetail['status'], string> = {
  DRAFT: 'Borrador',
  ISSUED: 'Pendiente de firma',
  SIGNED: 'Firmado',
  VOIDED: 'Anulado',
};

// Renders one consent as a text-safe, addressable clinical-history entry.
function ConsentRow({ item, patientId }: { item: ConsentDetail; patientId: string }) {
  return (
    <Link
      className="document-row consent-row"
      to={`/pacientes/${patientId}/historia/consentimientos/${item.id}`}
    >
      <span className="document-row__copy">
        <span className="document-row__title">
          <strong>{item.title || 'Consentimiento sin título'}</strong>
          <Badge
            tone={
              item.status === 'SIGNED' ? 'success' : item.status === 'VOIDED' ? 'warning' : 'info'
            }
          >
            {CONSENT_STATUS[item.status]}
          </Badge>
        </span>
        <small>
          Versión {item.version} · {new Date(item.updatedAt).toLocaleString('es-CO')}
        </small>
        {item.encounterStatus === 'VOIDED' || item.procedureStatus === 'VOIDED' ? (
          <small className="clinical-warning">
            El encuentro o procedimiento vinculado fue anulado.
          </small>
        ) : null}
      </span>
      <span aria-hidden="true" className="consent-row__arrow">
        ›
      </span>
    </Link>
  );
}

// Patient-level list is read-only except for opening drafts or entering a linked encounter to create one.
export function ConsentsPage() {
  const { patientId = '' } = useParams<{ patientId: string }>();
  const { activeMembership } = useAuth();
  const canRead = useCan(PERMISSION.CONSENTS_READ);
  const [items, setItems] = useState<ConsentDetail[]>([]);
  const [itemsOrganizationId, setItemsOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
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
      .listConsents(patientId, controller.signal)
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
  }, [activeMembership?.organization?.id, canRead, patientId]);

  const visibleItems = itemsOrganizationId === activeMembership?.organization?.id ? items : [];

  return (
    <section className="page-stack clinical-page documents-page">
      <PageHeader
        eyebrow="Historia clínica · Consentimientos"
        title="Consentimientos informados"
        description="Versiones, solicitudes de firma y evidencia asociadas al historial clínico."
        action={
          <Link className="button button--secondary" to={`/pacientes/${patientId}/historia`}>
            Volver a historia
          </Link>
        }
      />
      {error ? (
        <Alert tone="error" role="alert">
          {errorMessage(error, 'No fue posible consultar los consentimientos.')}
        </Alert>
      ) : null}
      <Card>
        {loading ? (
          <LoadingState label="Cargando consentimientos" />
        ) : visibleItems.length ? (
          <div className="document-list__rows">
            {visibleItems.map((item) => (
              <ConsentRow key={item.id} item={item} patientId={patientId} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No hay consentimientos todavía"
            description="Los borradores nuevos se crean desde un encuentro clínico para preservar su contexto."
          />
        )}
      </Card>
    </section>
  );
}

// Encounter-scoped actions preserve the clinical parent and make parent/archive restrictions visible before mutation.
export function ConsentEncounterSection({
  patientId,
  encounterId,
  encounterStatus,
  patientStatus,
}: {
  patientId: string;
  encounterId: string;
  encounterStatus: 'DRAFT' | 'FINALIZED' | 'VOIDED';
  patientStatus: 'ACTIVE' | 'ARCHIVED';
}) {
  const { activeMembership } = useAuth();
  const canRead = useCan(PERMISSION.CONSENTS_READ);
  const canCreate = useCan(PERMISSION.CONSENTS_CREATE);
  const [items, setItems] = useState<ConsentDetail[]>([]);
  const [loading, setLoading] = useState(canRead);
  const [error, setError] = useState<unknown>(null);
  const mayCreate = canCreate && encounterStatus !== 'VOIDED' && patientStatus === 'ACTIVE';

  const reload = useCallback(async () => {
    if (!activeMembership?.organization?.id || !canRead) return;
    setLoading(true);
    setError(null);
    try {
      setItems(
        (await documentsApi.listConsents(patientId)).filter(
          (item) => item.clinicalEncounterId === encounterId,
        ),
      );
    } catch (requestError: unknown) {
      setError(requestError);
    } finally {
      setLoading(false);
    }
  }, [activeMembership?.organization?.id, canRead, encounterId, patientId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!canRead && !canCreate) return null;
  return (
    <Card className="document-list consent-encounter-section">
      <div className="detail-card__heading">
        <div>
          <p className="section-kicker">Autorización clínica</p>
          <h2>Consentimientos</h2>
        </div>
        {mayCreate ? (
          <Button
            as={Link}
            to={`/pacientes/${patientId}/historia/encuentros/${encounterId}/consentimientos/nuevo`}
          >
            Nuevo borrador
          </Button>
        ) : null}
      </div>
      {encounterStatus === 'VOIDED' ? (
        <Alert tone="warning" role="status">
          El encuentro está anulado. El historial sigue disponible, pero no se pueden crear ni
          firmar consentimientos.
        </Alert>
      ) : null}
      {patientStatus === 'ARCHIVED' ? (
        <Alert tone="warning" role="status">
          El paciente está archivado. Los documentos históricos pueden consultarse, pero no se
          pueden crear ni emitir consentimientos.
        </Alert>
      ) : null}
      {error ? (
        <Alert tone="error" role="alert">
          {errorMessage(error, 'No fue posible cargar los consentimientos.')}
        </Alert>
      ) : null}
      {!canRead ? (
        <p className="clinical-muted">
          No tienes permiso para consultar consentimientos existentes.
        </p>
      ) : loading ? (
        <LoadingState label="Cargando consentimientos del encuentro" />
      ) : items.length ? (
        <div className="document-list__rows">
          {items.map((item) => (
            <ConsentRow key={item.id} item={item} patientId={patientId} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Este encuentro no tiene consentimientos"
          description="Los borradores conservan el paciente, la consulta y el procedimiento asociado."
        />
      )}
    </Card>
  );
}
