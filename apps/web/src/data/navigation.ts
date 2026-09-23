export type NavigationItem = {
  label: string;
  path: string;
  icon: string;
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
        icon: '⌂',
        description: 'Vista general de la operación.',
      },
      {
        label: 'Agenda',
        path: '/agenda',
        icon: '◷',
        description: 'Agenda y disponibilidad futura.',
      },
      {
        label: 'Disponibilidad',
        path: '/agenda/disponibilidad',
        icon: '▦',
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
        icon: '●',
        description: 'Registro clínico de pacientes.',
      },
      {
        label: 'Propietarios',
        path: '/propietarios',
        icon: '○',
        description: 'Personas responsables de pacientes.',
      },
      {
        label: 'Seguimientos',
        path: '/seguimientos',
        icon: '◷',
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
        icon: '✂',
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
        icon: '▥',
        description: 'Productos y existencias.',
      },
      { label: 'Ventas', path: '/ventas', icon: '↗', description: 'Ventas y pedidos.' },
      {
        label: 'Facturación',
        path: '/facturacion',
        icon: '▧',
        description: 'Documentos de venta.',
      },
      { label: 'Caja', path: '/caja', icon: '◒', description: 'Movimientos y cierres.' },
    ],
  },
  {
    label: 'Gestión',
    items: [
      {
        label: 'Informes',
        path: '/informes',
        icon: '▦',
        description: 'Indicadores agregados según tu rol.',
      },
      {
        label: 'Usuarios',
        path: '/usuarios',
        icon: '♙',
        description: 'Accesos y roles del personal de esta organización.',
      },
      {
        label: 'Configuración',
        path: '/configuracion',
        icon: '⚙',
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
      icon: '♙',
      description: 'Identidad clínica de la organización activa.',
    };
  }
  return (
    MODULE_ROUTES.find(
      (route) => route.path === pathname || pathname.startsWith(`${route.path}/`),
    ) ?? {
      label: 'Página no encontrada',
      path: pathname,
      icon: '?',
      description: 'La ruta solicitada no existe.',
    }
  );
}
