import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandMark } from '../brand/BrandMark';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/useAuth';
import '../../styles/platform.css';

const links = [
  { to: '/plataforma', label: 'Resumen', icon: '/icons-3d/platform/overview.png', end: true },
  {
    to: '/plataforma/clinicas',
    label: 'Clínicas',
    icon: '/icons-3d/platform/clinics.png',
    end: false,
  },
  {
    to: '/plataforma/suscripciones',
    label: 'Planes',
    icon: '/icons-3d/platform/plans.png',
    end: false,
  },
  {
    to: '/plataforma/cuentas',
    label: 'Cuentas',
    icon: '/icons-3d/platform/accounts.png',
    end: false,
  },
  {
    to: '/plataforma/actividad',
    label: 'Auditoría',
    icon: '/icons-3d/platform/audit.png',
    end: false,
  },
];

export function PlatformShell() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function signOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="platform-shell">
      <aside className="platform-sidebar" aria-label="Consola de Easyvet">
        <Link
          className="platform-brand"
          to="/plataforma"
          aria-label="Easyvet, consola de plataforma"
        >
          <BrandMark compact />
          <span>
            <strong>Easyvet</strong>
            <small>Consola de plataforma</small>
          </span>
        </Link>
        <nav className="platform-nav" aria-label="Navegación de plataforma">
          <p className="platform-nav__label">Administración</p>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `platform-nav__link${isActive ? ' platform-nav__link--active' : ''}`
              }
            >
              <span className="platform-nav__icon" aria-hidden="true">
                <img src={link.icon} alt="" width="28" height="28" decoding="async" />
              </span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="platform-sidebar__footer">
          <span className="platform-account__initials" aria-hidden="true">
            {(user?.email.slice(0, 2) ?? 'EV').toUpperCase()}
          </span>
          <span className="platform-account__copy">
            <strong>Super admin</strong>
            <small>{user?.email}</small>
          </span>
          <Button variant="ghost" type="button" onClick={() => void signOut()}>
            Salir
          </Button>
        </div>
      </aside>
      <main className="platform-main">
        <Outlet />
      </main>
    </div>
  );
}
