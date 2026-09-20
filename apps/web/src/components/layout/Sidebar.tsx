import { NavLink } from 'react-router-dom';
import { BrandMark } from '../brand/BrandMark';
import { NAVIGATION_GROUPS } from '../../data/navigation';
import { appConfig } from '../../config/app';

type SidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
};

// Sidebar translates the legacy app switcher into real route navigation.
export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  return (
    <>
      <button
        className={open ? 'sidebar-scrim is-visible' : 'sidebar-scrim'}
        type="button"
        aria-label="Cerrar navegación"
        onClick={onClose}
      />
      <aside
        className={['sidebar', open ? 'sidebar--open' : '', collapsed ? 'sidebar--collapsed' : '']
          .filter(Boolean)
          .join(' ')}
      >
        <div className="sidebar__top">
          <NavLink
            className="brand-lockup"
            to="/dashboard"
            onClick={onClose}
            aria-label={`${appConfig.name}, ir al dashboard`}
          >
            <BrandMark compact={collapsed} />
            <span className="brand-lockup__copy">
              <strong>{appConfig.shortName}</strong>
              <small>Operación veterinaria</small>
            </span>
          </NavLink>
          <button
            className="sidebar__close icon-button"
            type="button"
            aria-label="Cerrar navegación"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Navegación principal">
          {NAVIGATION_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group__label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  end
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    isActive ? 'nav-item nav-item--active' : 'nav-item'
                  }
                  onClick={onClose}
                >
                  <span className="nav-item__icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="nav-item__label">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <NavLink className="nav-item nav-item--utility" to="/health" onClick={onClose}>
            <span className="nav-item__icon" aria-hidden="true">
              ◉
            </span>
            <span className="nav-item__label">Estado técnico</span>
          </NavLink>
          <button
            className="collapse-button"
            type="button"
            onClick={onToggleCollapse}
            aria-pressed={collapsed}
          >
            <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
            <span>{collapsed ? 'Expandir' : 'Colapsar'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
