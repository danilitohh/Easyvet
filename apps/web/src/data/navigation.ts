import type { EasyvetIconName } from '../components/icons/EasyvetIcon';

export type NavigationItem = {
  label: string;
  path: string;
  icon: EasyvetIconName;
  description: string;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

// Navigation is data so the sidebar and route metadata share one stable source.
export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    label: 'Principal',
    items: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        icon: 'bar-chart',
        description: 'Vista general de la operación.',
      },
      {
        label: 'Agenda',
        path: '/agenda',
        icon: 'calendar',
        description: 'Agenda y disponibilidad futura.',
      },
      {
        label: 'Disponibilidad',
        path: '/agenda/disponibilidad',
        icon: 'calendar-heart',
        description: 'Horarios recurrentes por sede y profesional.',
      },
    ],
  },
  {
    label: 'Clínica',
    items: [
      {
        label: 'Pacientes',
        path: '/pacientes',
        icon: 'paw',
        description: 'Registro clínico de pacientes.',
      },
      {
        label: 'Propietarios',
        path: '/propietarios',
        icon: 'users',
        description: 'Personas responsables de pacientes.',
      },
      {
        label: 'Seguimientos',
        path: '/seguimientos',
        icon: 'check',
        description: 'Tareas clínicas y recordatorios internos.',
      },
    ],
  },
  {
    label: 'Servicios',
    items: [
      {
        label: 'Peluquería',
        path: '/peluqueria',
        icon: 'sparkle',
        description: 'Servicios de peluquería y spa.',
      },
    ],
  },
  {
    label: 'Comercial',
    items: [
      {
        label: 'Inventario',
        path: '/inventario',
        icon: 'package',
        description: 'Productos y existencias.',
      },
      { label: 'Ventas', path: '/ventas', icon: 'receipt', description: 'Ventas y pedidos.' },
      {
        label: 'Facturación',
        path: '/facturacion',
        icon: 'receipt',
        description: 'Documentos de venta.',
      },
      { label: 'Caja', path: '/caja', icon: 'bar-chart', description: 'Movimientos y cierres.' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      {
        label: 'Informes',
        path: '/informes',
        icon: 'activity',
        description: 'Indicadores agregados según tu rol.',
      },
      {
        label: 'Usuarios',
        path: '/usuarios',
        icon: 'users',
        description: 'Accesos y roles del personal de esta organización.',
      },
      {
        label: 'Configuración',
        path: '/configuracion',
        icon: 'settings',
        description: 'Datos de la organización, sedes y valores comerciales.',
      },
    ],
  },
];

// Flattened route metadata powers the page header without duplicating labels.
export const MODULE_ROUTES = NAVIGATION_GROUPS.flatMap((group) => group.items);

export function getRouteMeta(pathname: string): NavigationItem {
  if (pathname.startsWith('/perfil/profesional')) {
    return {
      label: 'Perfil profesional',
      path: '/perfil/profesional',
      icon: 'users',
      description: 'Identidad clínica de la organización activa.',
    };
  }
  return (
    MODULE_ROUTES.find(
      (route) => route.path === pathname || pathname.startsWith(`${route.path}/`),
    ) ?? {
      label: 'Página no encontrada',
      path: pathname,
      icon: 'sparkle',
      description: 'La ruta solicitada no existe.',
    }
  );
}
