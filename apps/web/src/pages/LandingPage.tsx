import { useEffect } from 'react';
import { Chip } from '@heroui/react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/brand/BrandMark';
import { EasyvetIcon, type EasyvetIconName } from '../components/icons/EasyvetIcon';
import { LiquidGlassCard } from '../components/kokonutui/LiquidGlassCard';
import { ParticleLink } from '../components/kokonutui/ParticleLink';
import { ShimmerText } from '../components/kokonutui/ShimmerText';
import { AnimatedContent } from '../components/reactbits/AnimatedContent';
import { PillNav } from '../components/reactbits/PillNav';
import { SpotlightCard } from '../components/reactbits/SpotlightCard';
import { SpecularButton } from '../components/reactbits/SpecularButton';
import '../styles/landing.css';

const features: Array<{
  number: string;
  icon: EasyvetIconName;
  title: string;
  description: string;
}> = [
  {
    number: '01',
    icon: 'calendar',
    title: 'Agenda que respira',
    description: 'Organiza consultas, procedimientos y peluquería en una vista clara para todo el equipo.',
  },
  {
    number: '02',
    icon: 'clipboard-heart',
    title: 'Historias clínicas completas',
    description: 'Ten la evolución de cada paciente a la mano, desde la consulta hasta el seguimiento.',
  },
  {
    number: '03',
    icon: 'bar-chart',
    title: 'Una operación conectada',
    description: 'Une pacientes, inventario, ventas y facturación en el mismo ritmo de trabajo.',
  },
];

const signalItems: Array<[string, EasyvetIconName]> = [
  ['Agenda', 'calendar'],
  ['Pacientes', 'paw'],
  ['Historias clínicas', 'clipboard-heart'],
  ['Inventario', 'package'],
  ['Facturación', 'receipt'],
];

const workflowItems: Array<[string, string, EasyvetIconName]> = [
  ['Agenda', 'Todo el día en una sola vista', 'calendar'],
  ['Pacientes', 'Información clínica siempre disponible', 'paw'],
  ['Inventario', 'Existencias bajo control', 'package'],
  ['Reportes', 'Decisiones con contexto', 'bar-chart'],
];

export function LandingPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Easyvet | Gestión veterinaria';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href="#inicio" aria-label="Easyvet, inicio">
          <BrandMark />
          <span className="landing-brand__copy">
            <strong>Easyvet</strong>
            <small>Gestión veterinaria</small>
          </span>
        </a>

        <PillNav
          className="landing-nav"
          items={[
            { href: '#producto', label: 'Producto' },
            { href: '#flujo', label: 'Cómo funciona' },
            { href: '#contacto', label: 'Contacto' },
          ]}
          ariaLabel="Navegación pública"
        />

        <div className="landing-header__actions">
          <Link className="landing-login-link" to="/login">
            Ingresar
          </Link>
          <SpecularButton>
            <Link className="landing-button landing-button--primary landing-button--small" to="/login">
              Entrar a Easyvet <EasyvetIcon name="arrow-up-right" size={15} />
            </Link>
          </SpecularButton>
        </div>
      </header>

      <section className="landing-hero" id="inicio" aria-labelledby="landing-title">
        <AnimatedContent className="landing-hero__copy">
          <p className="landing-eyebrow">
            <span className="landing-eyebrow__dot" aria-hidden="true" />
            <ShimmerText>Operación veterinaria, en calma</ShimmerText>
          </p>
          <h1 id="landing-title">
            Más tiempo para cuidar.
            <span> Menos tiempo buscando.</span>
          </h1>
          <p className="landing-hero__description">
            Easyvet reúne la agenda, los pacientes y la operación de tu clínica en un solo lugar,
            para que tu equipo trabaje con claridad desde la primera consulta.
          </p>
          <div className="landing-hero__actions">
            <SpecularButton>
              <ParticleLink className="landing-button landing-button--primary" to="/login">
                Conocer la plataforma <EasyvetIcon name="arrow-up-right" size={16} />
              </ParticleLink>
            </SpecularButton>
            <a className="landing-button landing-button--quiet" href="#producto">
              Ver cómo funciona <EasyvetIcon name="arrow-down" size={16} />
            </a>
          </div>
          <div className="landing-proof" aria-label="Beneficios de Easyvet">
            <span><i aria-hidden="true"><EasyvetIcon name="check" size={13} /></i> Pensado para equipos veterinarios</span>
            <span><i aria-hidden="true"><EasyvetIcon name="check" size={13} /></i> Información organizada</span>
          </div>
        </AnimatedContent>

        <AnimatedContent className="landing-hero__visual" delay={120} aria-label="Vista previa del dashboard de Easyvet">
          <div className="landing-visual-orb landing-visual-orb--one" aria-hidden="true" />
          <div className="landing-visual-orb landing-visual-orb--two" aria-hidden="true" />
          <div className="landing-dashboard-preview">
            <div className="landing-dashboard-preview__topbar">
              <div className="landing-preview-brand">
                <span className="landing-preview-brand__mark" aria-hidden="true">E</span>
                <strong>Easyvet</strong>
              </div>
              <span className="landing-preview-date">Hoy, 12 de octubre</span>
              <span className="landing-preview-avatar" aria-hidden="true">AM</span>
            </div>
            <div className="landing-dashboard-preview__body">
              <div className="landing-preview-heading">
                <div>
                  <span className="landing-preview-kicker">Panel principal</span>
                  <strong>Buenos días, Amelia</strong>
                </div>
                <Chip className="landing-preview-status" color="success" size="sm" variant="soft">
                  <EasyvetIcon name="activity" size={12} /> Clínica activa
                </Chip>
              </div>
              <div className="landing-preview-stats">
                <div className="landing-preview-stat landing-preview-stat--accent">
                  <span>Citas de hoy</span>
                  <strong>24</strong>
                  <small>8 pendientes</small>
                </div>
                <div className="landing-preview-stat">
                  <span>Pacientes activos</span>
                  <strong>1.284</strong>
                  <small>+12 este mes</small>
                </div>
                <div className="landing-preview-stat">
                  <span>Seguimientos</span>
                  <strong>18</strong>
                  <small>3 requieren atención</small>
                </div>
              </div>
              <div className="landing-preview-lower">
                <div className="landing-preview-schedule">
                  <div className="landing-preview-card-heading">
                    <strong>Agenda de hoy</strong>
                    <span>Ver agenda <EasyvetIcon name="arrow-up-right" size={12} /></span>
                  </div>
                  <div className="landing-appointment">
                    <time>09:00</time>
                    <span className="landing-appointment__avatar landing-appointment__avatar--blue">B</span>
                    <div><strong>Bella</strong><small>Consulta general · Dra. Castro</small></div>
                    <em>En curso</em>
                  </div>
                  <div className="landing-appointment">
                    <time>10:30</time>
                    <span className="landing-appointment__avatar landing-appointment__avatar--gold">M</span>
                    <div><strong>Milo</strong><small>Vacunación · Dr. Rojas</small></div>
                    <em className="landing-appointment__pending">Pendiente</em>
                  </div>
                  <div className="landing-appointment">
                    <time>12:00</time>
                    <span className="landing-appointment__avatar landing-appointment__avatar--rose">L</span>
                    <div><strong>Luna</strong><small>Control · Dra. Castro</small></div>
                    <em className="landing-appointment__confirmed">Confirmada</em>
                  </div>
                </div>
                <div className="landing-preview-inventory">
                  <div className="landing-preview-card-heading">
                    <strong>Inventario</strong>
                    <span className="landing-preview-alert">2 alertas</span>
                  </div>
                  <div className="landing-stock-item"><span>Vacuna antirrábica</span><b>12</b><i className="landing-stock-bar"><span style={{ width: '34%' }} /></i></div>
                  <div className="landing-stock-item"><span>Jeringas 5 ml</span><b>86</b><i className="landing-stock-bar"><span className="landing-stock-bar__good" style={{ width: '72%' }} /></i></div>
                  <div className="landing-stock-item"><span>Isoflurano</span><b>4</b><i className="landing-stock-bar"><span className="landing-stock-bar__warn" style={{ width: '18%' }} /></i></div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedContent>
      </section>

      <section className="landing-signal" aria-label="Áreas de trabajo">
        <p>Todo lo importante de tu clínica, conectado.</p>
        <div className="landing-signal__items">
          {signalItems.map(([label, icon]) => (
            <span key={label}><b aria-hidden="true"><EasyvetIcon name={icon} size={15} /></b> {label}</span>
          ))}
        </div>
      </section>

      <section className="landing-section landing-section--features" id="producto" aria-labelledby="features-title">
        <AnimatedContent className="landing-section__intro">
          <p className="landing-eyebrow"><ShimmerText>Una operación más ligera</ShimmerText></p>
          <h2 id="features-title">La claridad también es parte del cuidado.</h2>
          <p>Una herramienta serena para las decisiones que hacen avanzar tu clínica todos los días.</p>
        </AnimatedContent>
        <div className="landing-feature-grid">
          {features.map((feature) => (
            <SpotlightCard className="landing-feature-card" key={feature.number}>
              <div className="landing-feature-card__topline">
                <span className="landing-feature-card__icon" aria-hidden="true"><EasyvetIcon name={feature.icon} size={19} /></span>
                <span>{feature.number}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <span className="landing-feature-card__arrow" aria-hidden="true"><EasyvetIcon name="arrow-up-right" size={17} /></span>
            </SpotlightCard>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="flujo" aria-labelledby="workflow-title">
        <AnimatedContent className="landing-workflow__copy">
          <p className="landing-eyebrow">Un solo ritmo de trabajo</p>
          <h2 id="workflow-title">De la primera cita al seguimiento.</h2>
          <p>
            Cada área de tu clínica habla con las demás. Así el equipo puede concentrarse en el
            paciente y no en perseguir información.
          </p>
          <Link className="landing-text-link" to="/login">
            Entrar a la plataforma <EasyvetIcon name="arrow-up-right" size={16} />
          </Link>
        </AnimatedContent>
        <AnimatedContent className="landing-workflow-card" delay={120}>
          <LiquidGlassCard className="landing-workflow-card__surface">
            <div className="landing-workflow-card__heading">
              <div>
                <span className="landing-preview-kicker">Tu clínica en contexto</span>
                <strong>Una vista para cada decisión</strong>
              </div>
              <span className="landing-workflow-card__spark" aria-hidden="true"><EasyvetIcon name="sparkle" size={18} /></span>
            </div>
            <div className="landing-workflow-list">
              {workflowItems.map(([title, description, icon]) => (
                <div className="landing-workflow-item" key={title}>
                  <span className="landing-workflow-item__number" aria-hidden="true"><EasyvetIcon name={icon} size={16} /></span>
                  <div><strong>{title}</strong><small>{description}</small></div>
                  <span className="landing-workflow-item__arrow" aria-hidden="true"><EasyvetIcon name="arrow-up-right" size={15} /></span>
                </div>
              ))}
            </div>
          </LiquidGlassCard>
        </AnimatedContent>
      </section>

      <section className="landing-cta" id="contacto" aria-labelledby="cta-title">
        <div>
          <p className="landing-eyebrow">El siguiente paso empieza aquí</p>
          <h2 id="cta-title">Haz que tu clínica se sienta más fácil.</h2>
        </div>
        <SpecularButton>
          <Link className="landing-button landing-button--light" to="/login">
            Entrar a Easyvet <EasyvetIcon name="arrow-up-right" size={16} />
          </Link>
        </SpecularButton>
      </section>

      <footer className="landing-footer">
        <div className="landing-brand landing-brand--footer">
          <BrandMark compact />
          <span className="landing-brand__copy"><strong>Easyvet</strong><small>Gestión veterinaria</small></span>
        </div>
        <p>Una operación más clara para cuidar mejor.</p>
        <span>© {new Date().getFullYear()} Easyvet</span>
      </footer>
    </main>
  );
}
