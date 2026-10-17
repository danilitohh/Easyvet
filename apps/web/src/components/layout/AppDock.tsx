import { useLocation } from 'react-router-dom';
import { PERMISSION } from '../../auth/permissions';
import { useCan } from '../../auth/useCan';
import { Dock, type DockItem } from '../reactbits/Dock';
import { EasyvetIcon } from '../icons/EasyvetIcon';

const dockRoutes = [
  { href: '/dashboard', label: 'Inicio', icon: 'bar-chart' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar', permission: PERMISSION.APPOINTMENTS_READ },
  { href: '/pacientes', label: 'Pacientes', icon: 'paw', permission: PERMISSION.PATIENTS_READ },
  {
    href: '/inventario',
    label: 'Inventario',
    icon: 'package',
    permission: PERMISSION.INVENTORY_READ,
  },
  {
    href: '/informes',
    label: 'Informes',
    icon: 'activity',
    permission: PERMISSION.REPORTS_OPERATIONAL,
  },
] as const;

function isDockRouteActive(pathname: string, href: string) {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

// Mobile-friendly quick navigation that complements, rather than replaces, the full sidebar.
export function AppDock() {
  const { pathname } = useLocation();
  const canReadAppointments = useCan(PERMISSION.APPOINTMENTS_READ);
  const canReadPatients = useCan(PERMISSION.PATIENTS_READ);
  const canReadInventory = useCan(PERMISSION.INVENTORY_READ);
  const canReadOperationalReports = useCan(PERMISSION.REPORTS_OPERATIONAL);
  const canReadClinicalReports = useCan(PERMISSION.REPORTS_CLINICAL);
  const canReadCommercialReports = useCan(PERMISSION.REPORTS_COMMERCIAL);
  const canReadInventoryReports = useCan(PERMISSION.REPORTS_INVENTORY);
  const canReadAnyReport =
    canReadOperationalReports ||
    canReadClinicalReports ||
    canReadCommercialReports ||
    canReadInventoryReports;
  const permissions = {
    [PERMISSION.APPOINTMENTS_READ]: canReadAppointments,
    [PERMISSION.PATIENTS_READ]: canReadPatients,
    [PERMISSION.INVENTORY_READ]: canReadInventory,
    [PERMISSION.REPORTS_OPERATIONAL]: canReadAnyReport,
  };
  const items: DockItem[] = dockRoutes
    .filter((item) => !('permission' in item) || permissions[item.permission])
    .map((item) => ({
      href: item.href,
      label: item.label,
      icon: <EasyvetIcon name={item.icon} size={18} />,
      active: isDockRouteActive(pathname, item.href),
    }));

  return <Dock className="app-dock" items={items} />;
}
