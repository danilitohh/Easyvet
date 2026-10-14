import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { AuthSubmitButton } from '../components/auth/AuthSubmitButton';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { ApiError } from '../services/apiClient';
import { authApi } from '../services/auth';

export function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!token) return;
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.confirmPasswordReset({ token, newPassword: password });
      setComplete(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'El enlace no es válido o ya venció. Solicita uno nuevo para continuar.'
          : 'No pudimos cambiar la contraseña. Revisa que tenga al menos 12 caracteres.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const description = complete
    ? 'Tu contraseña se cambió y cerramos las demás sesiones activas por seguridad.'
    : token
      ? 'Elige una contraseña de al menos 12 caracteres para proteger la cuenta de tu clínica.'
      : 'Para proteger tu cuenta, solicita un nuevo enlace de recuperación.';

  return (
    <AuthPageLayout
      eyebrow="Acceso protegido para tu clínica"
      title={
        <>
          Una nueva clave, <span>y listo.</span>
        </>
      }
      description="Recupera el acceso de forma segura y vuelve a trabajar con toda tu información en un mismo lugar."
      cardEyebrow="Nueva contraseña"
      cardTitle={complete ? 'Todo listo' : token ? 'Restablecer contraseña' : 'Enlace requerido'}
      cardDescription={description}
      backTo="/login"
      backLabel="Ir al ingreso"
    >
      {complete ? (
        <div className="auth-form__success" role="status">
          <p>Ya puedes ingresar con tu contraseña nueva.</p>
          <Link to="/login">Ingresar a Easyvet</Link>
        </div>
      ) : token ? (
        <form onSubmit={handleSubmit}>
          <FormField
            label="Nueva contraseña"
            htmlFor="reset-new-password"
            hint="Mínimo 12 caracteres."
          >
            <TextInput
              id="reset-new-password"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <FormField label="Confirma tu contraseña" htmlFor="reset-confirm-password">
            <TextInput
              id="reset-confirm-password"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              minLength={12}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </FormField>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <AuthSubmitButton
            label="Guardar contraseña nueva"
            pendingLabel="Actualizando…"
            pending={submitting}
          />
        </form>
      ) : (
        <div className="auth-form__success">
          <p>El enlace de recuperación solo se puede usar una vez y vence en poco tiempo.</p>
          <Link to="/recuperar-contrasena">Solicitar enlace nuevo</Link>
        </div>
      )}
    </AuthPageLayout>
  );
}
