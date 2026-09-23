import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { PageHeader } from '../../components/ui/PageHeader';
import { TextInput } from '../../components/ui/TextInput';
import { ApiError } from '../../services/apiClient';
import { useAuth } from '../../contexts/useAuth';
import './admin.css';

// The only post-login destination available until a temporary credential is replaced.
export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError('Usa una contraseña de entre 12 y 128 caracteres.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      navigate('/dashboard', { replace: true });
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : '';
      setError(
        code === 'INVALID_CURRENT_PASSWORD'
          ? 'La contraseña actual no es correcta.'
          : 'No fue posible actualizar la contraseña. Intenta de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <PageHeader
          eyebrow="Seguridad de la cuenta"
          title="Crea tu contraseña personal"
          description="Antes de continuar, reemplaza la contraseña temporal por una frase segura que solo tú conozcas."
        />
        <Card>
          <form className="page-stack" onSubmit={submit}>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <FormField label="Contraseña temporal actual" htmlFor="current-password">
              <TextInput
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </FormField>
            <FormField
              label="Nueva contraseña"
              htmlFor="new-password"
              hint="Mínimo 12 caracteres; se permiten frases largas."
            >
              <TextInput
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </FormField>
            <FormField label="Confirma la nueva contraseña" htmlFor="confirm-password">
              <TextInput
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </FormField>
            <div className="admin-actions">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando…' : 'Actualizar contraseña'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void logout()}>
                Cerrar sesión
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
