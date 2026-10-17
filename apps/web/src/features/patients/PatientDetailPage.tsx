import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EasyvetIcon } from '../../components/icons/EasyvetIcon';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { ApiError } from '../../services/apiClient';
import { ResourceError, StatusBadge } from '../shared/ResourceFeedback';
import { errorMessage } from '../shared/resourceUtils';
import { patientsApi } from './patientsApi';
import { usePatient } from './usePatients';

function ageLabel(birthDate: string | null): string {
  if (!birthDate) return 'No registrada';
  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) years -= 1;
  if (years < 1) {
    const months = Math.max(0, (today.getFullYear() - birth.getFullYear()) * 12 + monthDelta);
    return `${months} ${months === 1 ? 'mes' : 'meses'}`;
  }
  return `${years} ${years === 1 ? 'año' : 'años'}`;
}

function ownerName(patient: { owner: { firstName: string; lastName: string | null } }): string {
  return [patient.owner.firstName, patient.owner.lastName].filter(Boolean).join(' ');
}

function display(value: string | number | null): string {
  if (value === null || value === '') return 'No registrado';
  return String(value);
}

// Patient detail is intentionally a focused record, ready for future clinical modules without fake tabs.
export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const { patient, loading, error, reload } = usePatient(patientId);
  const canUpdate = useCan(PERMISSION.PATIENTS_UPDATE);
  const canArchive = useCan(PERMISSION.PATIENTS_ARCHIVE);
  const canReadClinical = useCan(PERMISSION.CLINICAL_RECORDS_READ);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<unknown>(null);

  async function archivePatient() {
    if (!patientId) return;
    setArchiveBusy(true);
    setArchiveError(null);
    try {
      await patientsApi.archive(patientId);
      setArchiveOpen(false);
      reload();
    } catch (requestError: unknown) {
      setArchiveError(requestError);
    } finally {
      setArchiveBusy(false);
    }
  }

  if (loading)
    return (
      <Card className="resource-card">
        <div className="loading-state" role="status">
          Cargando paciente
        </div>
      </Card>
    );
  if (error || !patient) {
    return (
      <div className="page-stack">
        <PageHeader
          eyebrow="Ficha del paciente"
          title="Detalle del paciente"
          description="Consulta de un paciente dentro de la organización activa."
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
        eyebrow="Ficha del paciente"
        title={patient.name}
        description={`${patient.species}${patient.breed ? ` · ${patient.breed}` : ''}`}
        action={
          <div className="page-actions">
            <Button as={Link} to="/pacientes" variant="secondary">
              Volver
            </Button>
            {canUpdate ? (
              <Button as={Link} to={`/pacientes/${patient.id}/editar`} variant="secondary">
                Editar
              </Button>
            ) : null}
            {canReadClinical ? (
              <Button as={Link} to={`/pacientes/${patient.id}/historia`} variant="secondary">
                Historia clínica
              </Button>
            ) : null}
            {canArchive && patient.status === 'ACTIVE' ? (
              <Button variant="danger" type="button" onClick={() => setArchiveOpen(true)}>
                Archivar
              </Button>
            ) : null}
          </div>
        }
      />
      {archiveError ? (
        <Alert tone="error" role="alert">
          {errorMessage(archiveError, 'No fue posible archivar este paciente.')}
        </Alert>
      ) : null}
      <div className="detail-grid">
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Información general</p>
              <h2>Datos del paciente</h2>
            </div>
            <StatusBadge status={patient.status} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Especie</dt>
              <dd>{patient.species}</dd>
            </div>
            <div>
              <dt>Raza</dt>
              <dd>{display(patient.breed)}</dd>
            </div>
            <div>
              <dt>Sexo</dt>
              <dd>
                {patient.sex === 'UNKNOWN'
                  ? 'No especificado'
                  : patient.sex === 'MALE'
                    ? 'Macho'
                    : 'Hembra'}
              </dd>
            </div>
            <div>
              <dt>Fecha de nacimiento</dt>
              <dd>
                {patient.birthDate ?? 'No registrada'}
                {patient.birthDateEstimated ? (
                  <span className="inline-note">Fecha estimada</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Edad calculada</dt>
              <dd>{ageLabel(patient.birthDate)}</dd>
            </div>
            <div>
              <dt>Color</dt>
              <dd>{display(patient.color)}</dd>
            </div>
            <div>
              <dt>Microchip</dt>
              <dd>{display(patient.microchipNumber)}</dd>
            </div>
            <div>
              <dt>Peso actual</dt>
              <dd>
                {patient.currentWeightKg ? `${patient.currentWeightKg} kg` : 'No registrado'}
                {patient.currentWeightKg ? (
                  <span className="inline-note">Último peso guardado</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Esterilización</dt>
              <dd>{patient.sterilized ? 'Sí' : 'No registrada'}</dd>
            </div>
          </dl>
          <div className="detail-note">
            <span>Notas</span>
            <p>{display(patient.notes)}</p>
          </div>
        </Card>
        <Card className="detail-card">
          <div className="detail-card__heading">
            <div>
              <p className="section-kicker">Responsable</p>
              <h2>Propietario</h2>
            </div>
          </div>
          <Link className="owner-summary" to={`/propietarios/${patient.owner.id}`}>
            <span className="owner-summary__avatar" aria-hidden="true">
              {patient.owner.firstName.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{ownerName(patient)}</strong>
              <small>
                {patient.owner.phone ?? patient.owner.email ?? 'Sin contacto registrado'}
              </small>
            </span>
            <span aria-hidden="true">
              <EasyvetIcon name="arrow-right" size={16} />
            </span>
          </Link>
          <div className="detail-note">
            <span>Contacto</span>
            <p>{patient.owner.email ?? 'Sin correo registrado'}</p>
          </div>
        </Card>
      </div>
      <Modal
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        title="Archivar paciente"
        description="El registro quedará disponible desde el filtro de archivados."
      >
        <p className="modal-note">
          No se eliminarán datos. Esta acción no crea ni modifica historia clínica.
        </p>
        <div className="modal-actions">
          <Button variant="secondary" type="button" onClick={() => setArchiveOpen(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={archiveBusy}
            onClick={() => void archivePatient()}
          >
            {archiveBusy ? 'Archivando…' : 'Confirmar archivado'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
