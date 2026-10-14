import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { AuthSubmitButton } from '../components/auth/AuthSubmitButton';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { ApiError } from '../services/apiClient';
import { authApi } from '../services/auth';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleVerify() {
    if (!token) return;
    setError('');
    setSubmitting(true);
    try {
      await authApi.verifyEmail(token);
      setVerified(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'El enlace no es válido o ya venció. Puedes solicitar uno nuevo.'
          : 'No pudimos confirmar el correo. Inténtalo nuevamente.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authApi.resendVerification(email);
      setSent(true);
    } catch {
      setError('No fue posible enviar el correo. Revisa la dirección e inténtalo más tarde.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout
      eyebrow="Un acceso seguro para tu clínica"
      title={
        <>
          Confirma tu <span>correo.</span>
        </>
      }
      description="Verificamos tu dirección antes de abrir el espacio de trabajo de tu veterinaria."
      cardEyebrow="Activación de cuenta"
      cardTitle={
        verified
          ? 'Correo confirmado'
          : token
            ? 'Activa tu cuenta'
            : sent
              ? 'Solicitud recibida'
              : 'Reenviar activación'
      }
      cardDescription={
        verified
          ? 'Tu cuenta ya está activa y puedes ingresar a Easyvet.'
          : token
            ? 'Pulsa para confirmar que esta dirección de correo te pertenece.'
            : sent
              ? 'Si existe una cuenta pendiente para ese correo, enviaremos un nuevo enlace de activación.'
              : 'Escribe el correo usado al crear tu cuenta y te enviaremos otro enlace.'
      }
      backTo="/login"
      backLabel="Ir al ingreso"
    >
      {verified ? (
        <Link className="auth-form__link-button" to="/login">
          Ingresar a Easyvet
        </Link>
      ) : token ? (
        <div className="auth-form__fields">
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleVerify();
            }}
          >
            <AuthSubmitButton
              label="Confirmar mi correo"
              pendingLabel="Confirmando…"
              pending={submitting}
            />
          </form>
          {error ? (
            <Link className="auth-form__secondary-link" to="/verificar-correo">
              Solicitar un enlace nuevo
            </Link>
          ) : null}
        </div>
      ) : sent ? (
        <p className="auth-form__success" role="status">
          Revisa también la carpeta de correo no deseado.
        </p>
      ) : (
        <form onSubmit={handleResend}>
          <FormField label="Correo de tu cuenta" htmlFor="verification-email">
            <TextInput
              id="verification-email"
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
          <AuthSubmitButton label="Enviar enlace" pendingLabel="Enviando…" pending={submitting} />
        </form>
      )}
    </AuthPageLayout>
  );
}
