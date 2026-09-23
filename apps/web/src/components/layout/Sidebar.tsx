import { NavLink } from 'react-router-dom';
import { BrandMark } from '../brand/BrandMark';
import { NAVIGATION_GROUPS } from '../../data/navigation';
import { appConfig } from '../../config/app';
import { useCan } from '../../auth/useCan';
import { PERMISSION } from '../../auth/permissions';

type SidebarProps = {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
};

// Sidebar translates the legacy app switcher into real route navigation.
export function Sidebar({ open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const canReadMembers = useCan(PERMISSION.MEMBERS_READ);
  const canReadSettings = useCan(PERMISSION.ORGANIZATION_SETTINGS_READ);
  const canReadOperationalReports = useCan(PERMISSION.REPORTS_OPERATIONAL);
  const canReadClinicalReports = useCan(PERMISSION.REPORTS_CLINICAL);
  const canReadCommercialReports = useCan(PERMISSION.REPORTS_COMMERCIAL);
  const canReadInventoryReports = useCan(PERMISSION.REPORTS_INVENTORY);
  const canReadAnyReport =
    canReadOperationalReports ||
    canReadClinicalReports ||
    canReadCommercialReports ||
    canReadInventoryReports;
  const canReadAvailability = useCan(PERMISSION.AVAILABILITY_READ);
  const canReadFollowUps = useCan(PERMISSION.FOLLOW_UPS_READ);
  const canReadGrooming = useCan(PERMISSION.GROOMING_READ);
  const canReadInventory = useCan(PERMISSION.INVENTORY_READ);
  const canReadSales = useCan(PERMISSION.SALES_READ);
  const canReadBilling = useCan(PERMISSION.BILLING_READ);
  const canReadCash = useCan(PERMISSION.CASH_READ);
  const visibleGroups = NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.path === '/usuarios') return canReadMembers;
      if (item.path === '/configuracion') return canReadSettings;
      if (item.path === '/informes') return canReadAnyReport;
      if (item.path === '/agenda/disponibilidad') return canReadAvailability;
      if (item.path === '/seguimientos') return canReadFollowUps;
      if (item.path === '/peluqueria') return canReadGrooming;
      if (item.path === '/inventario') return canReadInventory;
      if (item.path === '/ventas') return canReadSales;
      if (item.path === '/facturacion') return canReadBilling;
      if (item.path === '/caja') return canReadCash;
      return true;
    }),
  })).filter((group) => group.items.length > 0);
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
          {visibleGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-group__label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  end={item.path !== '/propietarios' && item.path !== '/pacientes'}
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
