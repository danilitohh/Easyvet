import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { AuthSubmitButton } from '../components/auth/AuthSubmitButton';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { ApiError } from '../services/apiClient';
import { authApi } from '../services/auth';

export function RegistrationPage() {
  const [displayName, setDisplayName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authApi.register({ displayName, clinicName, email, password });
      setRegistered(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'EMAIL_ALREADY_REGISTERED') {
        setError(
          'Este correo ya tiene una cuenta. Inicia sesión o solicita recuperar la contraseña.',
        );
      } else if (caught instanceof ApiError && caught.status === 503) {
        setError('El correo de activación no está disponible por el momento. Inténtalo más tarde.');
      } else {
        setError('No pudimos crear la cuenta. Revisa los datos e inténtalo de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout
      eyebrow="Tu clínica, lista para crecer"
      title={
        <>
          Empieza a cuidar con <span>más claridad.</span>
        </>
      }
      description="Crea el espacio de trabajo de tu veterinaria. En unos pasos tendrás agenda, pacientes y equipo organizados en Easyvet."
      cardEyebrow="Nueva cuenta"
      cardTitle={registered ? 'Revisa tu correo' : 'Registra tu clínica'}
      cardDescription={
        registered
          ? `Enviamos un enlace de activación a ${email}. Confirma tu correo para entrar.`
          : 'Crea el acceso de administración y el espacio de trabajo de tu clínica.'
      }
      backTo="/login"
      backLabel="Volver a ingresar"
      wideCard
    >
      {registered ? (
        <div className="auth-form__success" role="status">
          <p>Tu clínica ya quedó registrada. La cuenta se activa cuando confirmes el correo.</p>
          <Link to={`/verificar-correo?email=${encodeURIComponent(email)}`}>
            ¿No llegó? Reenviar correo de activación
          </Link>
          <p className="auth-form__switch">
            ¿Ya confirmaste? <Link to="/login">Inicia sesión</Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <FormField label="Tu nombre" htmlFor="registration-name">
            <TextInput
              id="registration-name"
              autoComplete="name"
              maxLength={160}
              minLength={2}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </FormField>
          <FormField label="Nombre de la veterinaria" htmlFor="registration-clinic">
            <TextInput
              id="registration-clinic"
              autoComplete="organization"
              maxLength={160}
              minLength={2}
              required
              value={clinicName}
              onChange={(event) => setClinicName(event.target.value)}
            />
          </FormField>
          <FormField label="Correo de trabajo" htmlFor="registration-email">
            <TextInput
              id="registration-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <FormField
            label="Contraseña"
            htmlFor="registration-password"
            hint="Usa al menos 12 caracteres."
          >
            <TextInput
              id="registration-password"
              type="password"
              autoComplete="new-password"
              maxLength={128}
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <AuthSubmitButton
            label="Crear mi cuenta"
            pendingLabel="Creando cuenta…"
            pending={submitting}
          />
          <p className="auth-form__switch">
            ¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link>
          </p>
        </form>
      )}
    </AuthPageLayout>
  );
}
