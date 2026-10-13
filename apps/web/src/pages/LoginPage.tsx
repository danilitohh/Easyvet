import { useState, type FormEvent } from 'react';
import { Button as HeroButton } from '@heroui/react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { TextInput } from '../components/ui/TextInput';
import { BrandMark } from '../components/brand/BrandMark';
import { EasyvetIcon } from '../components/icons/EasyvetIcon';
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
      <div className="auth-page__ambient auth-page__ambient--one" aria-hidden="true" />
      <div className="auth-page__ambient auth-page__ambient--two" aria-hidden="true" />
      <div className="auth-page__brand">
        <BrandMark />
        <span className="auth-page__brand-copy">
          <strong>Easyvet</strong>
          <small>Gestión veterinaria</small>
        </span>
      </div>
      <Link className="auth-page__back" to="/">
        <EasyvetIcon name="arrow-down" size={15} />
        Volver al inicio
      </Link>

      <div className="auth-page__layout">
        <section className="auth-welcome" aria-labelledby="auth-welcome-title">
          <p className="auth-welcome__eyebrow">
            <span className="auth-welcome__pulse" aria-hidden="true" />
            Un espacio para cuidar mejor
          </p>
          <div className="auth-welcome__mark" aria-hidden="true">
            <BrandMark />
          </div>
          <h1 id="auth-welcome-title">
            Bienvenido a <span>Easyvet.</span>
          </h1>
          <p className="auth-welcome__description">
            Tu clínica vuelve a tener el control. Entra para continuar con una operación más clara,
            tranquila y conectada.
          </p>
          <div className="auth-welcome__highlights" aria-label="Beneficios de Easyvet">
            <div>
              <EasyvetIcon name="calendar-heart" size={24} />
              <span><strong>Agenda en calma</strong><small>Todo el día, en una vista.</small></span>
            </div>
            <div>
              <EasyvetIcon name="paw" size={24} />
              <span><strong>Pacientes conectados</strong><small>La historia siempre disponible.</small></span>
            </div>
            <div>
              <EasyvetIcon name="heart-pulse" size={24} />
              <span><strong>Decisiones claras</strong><small>Tu equipo, en el mismo ritmo.</small></span>
            </div>
          </div>
        </section>

        <Card className="auth-card">
          <div className="auth-card__heading">
            <p className="eyebrow">Acceso seguro</p>
            <span className="auth-card__status" aria-hidden="true"><EasyvetIcon name="sparkle" size={16} /></span>
          </div>
          <h2>Bienvenido de nuevo</h2>
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
        </Card>
      </div>
    </main>
  );
}
