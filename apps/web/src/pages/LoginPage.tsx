import { useState, type FormEvent } from 'react';
import { Button as HeroButton } from '@heroui/react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { AuthPageLayout } from '../components/auth/AuthPageLayout';
import { EasyvetIcon } from '../components/icons/EasyvetIcon';
import { useAuth } from '../contexts/useAuth';
import { ApiError } from '../services/apiClient';

// LoginPage collects credentials without ever persisting the session token in JavaScript storage.
export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNeedsVerification(false);
    setSubmitting(true);
    try {
      const response = await login({ email, password });
      navigate(
        response.organizationSelectionRequired ? '/seleccionar-organizacion' : '/dashboard',
        {
          replace: true,
        },
      );
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
        setError('Confirma tu correo antes de ingresar.');
      } else {
        setError('Correo o contraseña no válidos.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageLayout
      eyebrow="Un espacio para cuidar mejor"
      title={
        <>
          Bienvenido a <span>Easyvet.</span>
        </>
      }
      description="Tu clínica vuelve a tener el control. Entra para continuar con una operación más clara, tranquila y conectada."
      cardEyebrow="Acceso seguro"
      cardTitle="Bienvenido de nuevo"
      cardDescription="Ingresa para continuar con la operación de tu clínica."
    >
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Correo" htmlFor="login-email">
          <TextInput
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </FormField>
        <FormField label="Contraseña" htmlFor="login-password">
          <TextInput
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </FormField>
        <div className="auth-form__utility">
          <Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {needsVerification ? (
          <Link
            className="auth-form__secondary-link"
            to={`/verificar-correo?email=${encodeURIComponent(email)}`}
          >
            Reenviar correo de activación
          </Link>
        ) : null}
        <HeroButton
          className="button--full login-submit"
          fullWidth
          isDisabled={submitting}
          isPending={submitting}
          size="lg"
          type="submit"
        >
          <span className="login-submit__content">
            <span>{submitting ? 'Ingresando…' : 'Ingresar'}</span>
            {!submitting ? <EasyvetIcon name="arrow-up-right" size={16} /> : null}
          </span>
        </HeroButton>
      </form>
      <p className="auth-form__switch">
        ¿Aún no tienes cuenta? <Link to="/registro">Crea tu cuenta gratis</Link>
      </p>
    </AuthPageLayout>
  );
}
