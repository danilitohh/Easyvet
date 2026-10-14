import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { AuthSubmitButton } from '../components/auth/AuthSubmitButton';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { ApiError } from '../services/apiClient';
import { authApi } from '../services/auth';

export function PasswordResetRequestPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authApi.requestPasswordReset({ email });
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 503
          ? 'La recuperación por correo no está disponible por el momento. Inténtalo más tarde.'
          : 'No pudimos procesar la solicitud. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout
      eyebrow="Tu cuenta sigue bajo tu control"
      title={
        <>
          Volvamos a entrar <span>juntos.</span>
        </>
      }
      description="Te enviaremos un enlace seguro para crear una contraseña nueva y volver a la operación de tu clínica."
      cardEyebrow="Recuperación segura"
      cardTitle={sent ? 'Revisa tu correo' : 'Recuperar contraseña'}
      cardDescription={
        sent
          ? `Si hay una cuenta asociada a ${email}, recibirás instrucciones para continuar.`
          : 'Escribe el correo de tu cuenta y te enviaremos un enlace temporal.'
      }
      backTo="/login"
      backLabel="Volver a ingresar"
    >
      {sent ? (
        <div className="auth-form__success" role="status">
          <p>
            Por seguridad, solo las cuentas registradas reciben el mensaje. Revisa también correo no
            deseado.
          </p>
          <Link to="/login">Volver al ingreso</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormField label="Correo de tu cuenta" htmlFor="reset-request-email">
            <TextInput
              id="reset-request-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <AuthSubmitButton
            label="Enviar enlace de recuperación"
            pendingLabel="Enviando…"
            pending={submitting}
          />
        </form>
      )}
    </AuthPageLayout>
  );
}
