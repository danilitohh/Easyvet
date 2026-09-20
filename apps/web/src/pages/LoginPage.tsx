import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { BrandMark } from '../components/brand/BrandMark';
import { useAuth } from '../contexts/useAuth';

// LoginPage collects credentials without ever persisting the session token in JavaScript storage.
export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await login({ email, password });
      navigate(
        response.organizationSelectionRequired ? '/seleccionar-organizacion' : '/dashboard',
        {
          replace: true,
        },
      );
    } catch {
      setError('Correo o contraseña no válidos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__brand">
        <BrandMark />
        <strong>Easyvet</strong>
      </div>
      <Card className="auth-card">
        <p className="eyebrow">Acceso seguro</p>
        <h1>Bienvenido de nuevo</h1>
        <p className="auth-card__intro">Ingresa para continuar con la operación de tu clínica.</p>
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
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <Button fullWidth type="submit" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
