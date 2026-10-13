import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/brand/BrandMark';
import '../styles/landing.css';

const features = [
  {
    number: '01',
    icon: '◷',
    title: 'Agenda que respira',
    description: 'Organiza consultas, procedimientos y peluquería en una vista clara para todo el equipo.',
  },
  {
    number: '02',
    icon: '✦',
    title: 'Historias clínicas completas',
    description: 'Ten la evolución de cada paciente a la mano, desde la consulta hasta el seguimiento.',
  },
  {
    number: '03',
    icon: '⌁',
    title: 'Una operación conectada',
    description: 'Une pacientes, inventario, ventas y facturación en el mismo ritmo de trabajo.',
  },
];

const workflowItems = [
  ['Agenda', 'Todo el día en una sola vista'],
  ['Pacientes', 'Información clínica siempre disponible'],
  ['Inventario', 'Existencias bajo control'],
  ['Reportes', 'Decisiones con contexto'],
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

        <nav className="landing-nav" aria-label="Navegación pública">
          <a href="#producto">Producto</a>
          <a href="#flujo">Cómo funciona</a>
          <a href="#contacto">Contacto</a>
        </nav>

        <div className="landing-header__actions">
          <Link className="landing-login-link" to="/login">
            Ingresar
          </Link>
          <Link className="landing-button landing-button--primary landing-button--small" to="/login">
            Entrar a Easyvet <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <section className="landing-hero" id="inicio" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <p className="landing-eyebrow">
            <span className="landing-eyebrow__dot" aria-hidden="true" />
            Operación veterinaria, en calma
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
            <Link className="landing-button landing-button--primary" to="/login">
              Conocer la plataforma <span aria-hidden="true">↗</span>
            </Link>
            <a className="landing-button landing-button--quiet" href="#producto">
              Ver cómo funciona <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="landing-proof" aria-label="Beneficios de Easyvet">
            <span><i aria-hidden="true">✓</i> Pensado para equipos veterinarios</span>
            <span><i aria-hidden="true">✓</i> Información organizada</span>
          </div>
        </div>

        <div className="landing-hero__visual" aria-label="Vista previa del dashboard de Easyvet">
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
                <span className="landing-preview-status"><i aria-hidden="true" /> Clínica activa</span>
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
                    <span>Ver agenda <b aria-hidden="true">↗</b></span>
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
        </div>
      </section>

      <section className="landing-signal" aria-label="Áreas de trabajo">
        <p>Todo lo importante de tu clínica, conectado.</p>
        <div className="landing-signal__items">
          <span><b aria-hidden="true">◷</b> Agenda</span>
          <span><b aria-hidden="true">✦</b> Pacientes</span>
          <span><b aria-hidden="true">⌁</b> Historias clínicas</span>
          <span><b aria-hidden="true">▥</b> Inventario</span>
          <span><b aria-hidden="true">▣</b> Facturación</span>
        </div>
      </section>

      <section className="landing-section landing-section--features" id="producto" aria-labelledby="features-title">
        <div className="landing-section__intro">
          <p className="landing-eyebrow">Una operación más ligera</p>
          <h2 id="features-title">La claridad también es parte del cuidado.</h2>
          <p>Una herramienta serena para las decisiones que hacen avanzar tu clínica todos los días.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map((feature) => (
            <article className="landing-feature-card" key={feature.number}>
              <div className="landing-feature-card__topline">
                <span className="landing-feature-card__icon" aria-hidden="true">{feature.icon}</span>
                <span>{feature.number}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <span className="landing-feature-card__arrow" aria-hidden="true">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-workflow" id="flujo" aria-labelledby="workflow-title">
        <div className="landing-workflow__copy">
          <p className="landing-eyebrow">Un solo ritmo de trabajo</p>
          <h2 id="workflow-title">De la primera cita al seguimiento.</h2>
          <p>
            Cada área de tu clínica habla con las demás. Así el equipo puede concentrarse en el
            paciente y no en perseguir información.
          </p>
          <Link className="landing-text-link" to="/login">
            Entrar a la plataforma <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="landing-workflow-card">
          <div className="landing-workflow-card__heading">
            <div>
              <span className="landing-preview-kicker">Tu clínica en contexto</span>
              <strong>Una vista para cada decisión</strong>
            </div>
            <span className="landing-workflow-card__spark" aria-hidden="true">✦</span>
          </div>
          <div className="landing-workflow-list">
            {workflowItems.map(([title, description], index) => (
              <div className="landing-workflow-item" key={title}>
                <span className="landing-workflow-item__number">0{index + 1}</span>
                <div><strong>{title}</strong><small>{description}</small></div>
                <span className="landing-workflow-item__arrow" aria-hidden="true">↗</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta" id="contacto" aria-labelledby="cta-title">
        <div>
          <p className="landing-eyebrow">El siguiente paso empieza aquí</p>
          <h2 id="cta-title">Haz que tu clínica se sienta más fácil.</h2>
        </div>
        <Link className="landing-button landing-button--light" to="/login">
          Entrar a Easyvet <span aria-hidden="true">↗</span>
        </Link>
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
