import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { ResourceError, StatusBadge } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { ownersApi } from './ownersApi';
import { useOwner } from './useOwners';

function ownerName(owner: { firstName: string; lastName: string | null }): string {
  return [owner.firstName, owner.lastName].filter(Boolean).join(' ');
}

function display(value: string | null): string {
  return value?.trim() || 'No registrado';
}

// Owner detail exposes only the approved Fase 4A fields and links to real patient routes.
export function OwnerDetailPage() {
  const { ownerId } = useParams<{ ownerId: string }>();
  const { owner, loading, error, reload } = useOwner(ownerId);
  const canUpdate = useCan(PERMISSION.OWNERS_UPDATE);
  const canArchive = useCan(PERMISSION.OWNERS_ARCHIVE);
  const canCreatePatient = useCan(PERMISSION.PATIENTS_CREATE);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<unknown>(null);

  async function archiveOwner() {
    if (!ownerId) return;
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await ownersApi.archive(ownerId);
      setArchiveOpen(false);
      reload();
    } catch (archiveRequestError: unknown) {
      setArchiveError(archiveRequestError);
    } finally {
      setArchiveBusy(false);
    }
  }

  if (loading) {
    return (
      <Card className="resource-card">
        <div className="loading-state" role="status">
          Cargando propietario
        </div>
      </Card>
    );
  }
  if (error || !owner) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Propietario"
          title="Detalle del propietario"
          description="Consulta de un propietario dentro de la organización activa."
        />
        <ResourceError
          error={error ?? new ApiError('Resource not found', 404, 'RESOURCE_NOT_FOUND')}
          {...(error ? { onRetry: reload } : {})}
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Propietario"
        title={ownerName(owner)}
        description="Datos de contacto y pacientes asociados en esta organización."
        action={
          <div className="page-actions">
            <Button as={Link} to="/propietarios" variant="secondary">
              Volver
            </Button>
            {canUpdate ? (
              <Button as={Link} to={`/propietarios/${owner.id}/editar`} variant="secondary">
                Editar
              </Button>
            ) : null}
            {canArchive && owner.status === 'ACTIVE' ? (
              <Button variant="danger" type="button" onClick={() => setArchiveOpen(true)}>
                Archivar
              </Button>
            ) : null}
          </div>
        }
      />
      {archiveError ? (
        <Alert tone="error" role="alert">
          {errorMessage(archiveError, 'No fue posible archivar este propietario.')}
        </Alert>
      ) : null}
      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Información básica</p>
              <h2>Datos del propietario</h2>
            </div>
            <StatusBadge status={owner.status} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Documento</dt>
              <dd>
                {owner.documentNumber
                  ? `${display(owner.documentType)} · ${owner.documentNumber}`
                  : 'No registrado'}
              </dd>
            </div>
            <div>
              <dt>Teléfono principal</dt>
              <dd>{display(owner.phone)}</dd>
            </div>
            <div>
              <dt>Teléfono secundario</dt>
              <dd>{display(owner.secondaryPhone)}</dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{display(owner.email)}</dd>
            </div>
            <div>
              <dt>Dirección</dt>
              <dd>{display(owner.address)}</dd>
            </div>
            <div>
              <dt>Ciudad</dt>
              <dd>{display(owner.city)}</dd>
            </div>
          </dl>
          <div className="detail-note">
            <span>Notas</span>
            <p>{display(owner.notes)}</p>
          </div>
        </Card>
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Relación</p>
              <h2>Pacientes</h2>
            </div>
            {canCreatePatient ? (
              <Button as={Link} to={`/pacientes/nuevo?ownerId=${owner.id}`} variant="secondary">
                Agregar paciente
              </Button>
            ) : null}
          </div>
          {owner.patients?.length ? (
            <ul className="related-list">
              {owner.patients.map((patient) => (
                <li key={patient.id}>
                  <Link to={`/pacientes/${patient.id}`}>
                    <span>
                      <strong>{patient.name}</strong>
                      <small>{patient.species}</small>
                    </span>
                    <StatusBadge status={patient.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-copy">No hay pacientes activos asociados a este propietario.</p>
          )}
        </Card>
      </div>
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archivar propietario"
        description="El archivado conserva los datos y no elimina sus pacientes."
      >
        <p className="modal-note">
          El propietario dejará de aparecer en los listados activos. Podrás seguir consultándolo
          desde el filtro de archivados.
        </p>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={() => setArchiveOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={archiveBusy}
            onClick={() => void archiveOwner()}
          >
            {archiveBusy ? 'Archivando…' : 'Confirmar archivado'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
