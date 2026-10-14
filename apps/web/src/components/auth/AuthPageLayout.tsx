import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../brand/BrandMark';
import { EasyvetIcon } from '../icons/EasyvetIcon';
import { Card } from '../ui/Card';

type AuthPageLayoutProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  cardEyebrow: string;
  cardTitle: string;
  cardDescription: string;
  backTo?: string;
  backLabel?: string;
  wideCard?: boolean;
  children: ReactNode;
};

const highlights = [
  ['calendar-heart', 'Agenda en calma', 'Todo el día, en una vista.'],
  ['paw', 'Pacientes conectados', 'La historia siempre disponible.'],
  ['heart-pulse', 'Decisiones claras', 'Tu equipo, en el mismo ritmo.'],
] as const;

// Shared account screens keep branding, welcome copy and form spacing consistent.
export function AuthPageLayout({
  eyebrow,
  title,
  description,
  cardEyebrow,
  cardTitle,
  cardDescription,
  backTo = '/',
  backLabel = 'Volver al inicio',
  wideCard = false,
  children,
}: AuthPageLayoutProps) {
  return (
    <main className="auth-page">
      <div className="auth-page__ambient auth-page__ambient--one" aria-hidden="true" />
      <div className="auth-page__ambient auth-page__ambient--two" aria-hidden="true" />
      <Link className="auth-page__brand" to="/" aria-label="Easyvet, inicio">
        <BrandMark />
        <span className="auth-page__brand-copy">
          <strong>Easyvet</strong>
          <small>Gestión veterinaria</small>
        </span>
      </Link>
      <Link className="auth-page__back" to={backTo}>
        <EasyvetIcon name="arrow-down" size={15} />
        {backLabel}
      </Link>

      <div className="auth-page__layout">
        <section className="auth-welcome" aria-labelledby="auth-welcome-title">
          <p className="auth-welcome__eyebrow">
            <span className="auth-welcome__pulse" aria-hidden="true" />
            {eyebrow}
          </p>
          <div className="auth-welcome__mark" aria-hidden="true">
            <BrandMark />
          </div>
          <h1 id="auth-welcome-title">{title}</h1>
          <p className="auth-welcome__description">{description}</p>
          <div className="auth-welcome__highlights" aria-label="Beneficios de Easyvet">
            {highlights.map(([icon, heading, detail]) => (
              <div key={heading}>
                <EasyvetIcon name={icon} size={24} />
                <span>
                  <strong>{heading}</strong>
                  <small>{detail}</small>
                </span>
              </div>
            ))}
          </div>
        </section>

        <Card
          className={`auth-card${wideCard ? ' auth-card--wide' : ''}`}
          aria-labelledby="auth-card-title"
        >
          <div className="auth-card__heading">
            <p className="eyebrow">{cardEyebrow}</p>
            <span className="auth-card__status" aria-hidden="true">
              <EasyvetIcon name="sparkle" size={16} />
            </span>
          </div>
          <h2 id="auth-card-title">{cardTitle}</h2>
          <p className="auth-card__intro">{cardDescription}</p>
          {children}
        </Card>
      </div>
    </main>
  );
}
