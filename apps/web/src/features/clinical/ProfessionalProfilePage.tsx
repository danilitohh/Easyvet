import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { LoadingState } from '../../components/ui/LoadingState';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { clinicalApi } from './clinicalApi';
import { useProfessionalProfile } from './useClinical';
import { errorMessage } from '../shared/resourceUtils';
import { ResourceError } from '../shared/ResourceFeedback';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';

// The profile page is deliberately small: it edits only the identity snapshot used by later
// clinical finalization and never accepts tenant or user identifiers from the browser.
export function ProfessionalProfilePage() {
  const canReadClinical = useCan(PERMISSION.CLINICAL_RECORDS_READ);
  const profile = useProfessionalProfile(canReadClinical);
  const [displayName, setDisplayName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<unknown>(null);

  useEffect(() => {
    if (profile.data) {
      setDisplayName(profile.data.displayName);
      setLicenseNumber(profile.data.licenseNumber ?? '');
      setSaved(false);
    }
  }, [profile.data]);

  if (profile.loading)
    return (
      <div className="page-stack">
        <LoadingState label="Cargando perfil profesional" />
      </div>
    );
  if (profile.error) return <ResourceError error={profile.error} onRetry={profile.reload} />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setServerError(null);
    try {
      await clinicalApi.updateProfessionalProfile({
        displayName: displayName.trim(),
        licenseNumber: licenseNumber.trim() || null,
      });
      setSaved(true);
      profile.reload();
    } catch (error: unknown) {
      setServerError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack clinical-page">
      <PageHeader
        eyebrow="Perfil profesional"
        title="Tu perfil profesional"
        description="Esta identidad se mantiene por organización y podrá aparecer en la historia clínica."
        action={
          <Button as={Link} to="/configuracion" variant="secondary">
            Volver a configuración
          </Button>
        }
      />
      <Card className="form-card">
        <form className="domain-form" onSubmit={(event) => void submit(event)} noValidate>
          {serverError ? (
            <Alert tone="error" role="alert">
              {errorMessage(serverError, 'No fue posible guardar tu perfil profesional.')}
            </Alert>
          ) : null}
          {saved ? (
            <Alert tone="success" role="status">
              Perfil profesional guardado.
            </Alert>
          ) : null}
          <div className="form-section">
            <div>
              <p className="section-kicker">Identidad clínica</p>
              <h2>Datos visibles para el equipo</h2>
            </div>
            <p>La configuración se guarda únicamente para la organización activa.</p>
          </div>
          <FormField
            label="Nombre para mostrar *"
            htmlFor="professional-display-name"
            hint="Usa el nombre con el que el equipo te identifica en la consulta."
          >
            <TextInput
              id="professional-display-name"
              value={displayName}
              maxLength={160}
              required
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </FormField>
          <FormField
            label="Número de licencia"
            htmlFor="professional-license-number"
            hint="Opcional; se conserva como texto y no se valida contra un registro externo."
          >
            <TextInput
              id="professional-license-number"
              value={licenseNumber}
              maxLength={80}
              onChange={(event) => setLicenseNumber(event.target.value)}
            />
          </FormField>
          <div className="form-actions">
            <Button type="submit" disabled={saving || !displayName.trim()}>
              {saving ? 'Guardando…' : 'Guardar perfil'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
