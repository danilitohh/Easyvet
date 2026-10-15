import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { AuthSubmitButton } from '../components/auth/AuthSubmitButton';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { ApiError } from '../services/apiClient';
import { authApi } from '../services/auth';

export function PlatformAdminBootstrapPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [bootstrapSecret, setBootstrapSecret] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('La confirmación no coincide con la contraseña.');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.bootstrapPlatformAdmin({ email, password, bootstrapSecret });
      setCreated(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'PLATFORM_ALREADY_INITIALIZED') {
        setError(
          'La plataforma ya tiene un super admin inicializado. Ingresa desde el acceso habitual.',
        );
      } else if (caught instanceof ApiError && caught.code === 'EMAIL_ALREADY_REGISTERED') {
        setError('Ese correo ya pertenece a una cuenta. Usa otro correo para el super admin.');
      } else if (caught instanceof ApiError && caught.code === 'INVALID_BOOTSTRAP_CREDENTIAL') {
        setError(
          'La clave de configuración no es correcta. Revísala en las variables de entorno de Vercel.',
        );
      } else {
        setError(
          'No fue posible crear la cuenta. Verifica que la configuración inicial siga habilitada.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout
      eyebrow="Administración de Easyvet"
      title={
        <>
          Configura el acceso de <span>plataforma.</span>
        </>
      }
      description="Esta cuenta administra Easyvet y no necesita crear ni pertenecer a una veterinaria."
      cardEyebrow="Configuración protegida de un solo uso"
      cardTitle={created ? 'Super admin creado' : 'Crear cuenta de super admin'}
      cardDescription={
        created
          ? `La cuenta ${email} quedó creada sin una clínica asociada. Ya puedes iniciar sesión.`
          : 'Necesitas la clave de configuración privada definida en las variables de entorno de Vercel.'
      }
      backTo="/login"
      backLabel="Volver al inicio de sesión"
      wideCard
    >
      {created ? (
        <div className="auth-form__success" role="status">
          <p>
            Por seguridad, elimina PLATFORM_ADMIN_BOOTSTRAP_SECRET de Vercel después de confirmar el
            acceso.
          </p>
          <Link to="/login">Ir a iniciar sesión</Link>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)}>
          <FormField label="Correo del super admin" htmlFor="platform-bootstrap-email">
            <TextInput
              id="platform-bootstrap-email"
              type="email"
              autoComplete="email"
              maxLength={320}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <FormField
            label="Clave de configuración"
            htmlFor="platform-bootstrap-secret"
            hint="Solo se usa para crear el primer super admin; no es tu contraseña de acceso."
          >
            <TextInput
              id="platform-bootstrap-secret"
              type="password"
              autoComplete="off"
              minLength={32}
              maxLength={512}
              required
              value={bootstrapSecret}
              onChange={(event) => setBootstrapSecret(event.target.value)}
            />
          </FormField>
          <FormField
            label="Contraseña de acceso"
            htmlFor="platform-bootstrap-password"
            hint="Mínimo 12 caracteres."
          >
            <TextInput
              id="platform-bootstrap-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <FormField label="Confirma la contraseña" htmlFor="platform-bootstrap-confirm">
            <TextInput
              id="platform-bootstrap-confirm"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
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
            label="Crear super admin"
            pendingLabel="Configurando acceso…"
            pending={submitting}
          />
          <p className="auth-form__switch">
            Este proceso solo funciona una vez y no crea clínicas ni membresías.
          </p>
        </form>
      )}
    </AuthPageLayout>
  );
}
