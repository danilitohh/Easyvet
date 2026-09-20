export type DemoAppointment = {
  id: string;
  time: string;
  patient: string;
  owner: string;
  service: string;
  status: 'Confirmada' | 'Pendiente' | 'En curso';
};

export const dashboardStats = [
  { label: 'Citas de hoy', value: '08', detail: '2 pendientes de confirmar', tone: 'teal' },
  { label: 'Consultas completadas', value: '12', detail: 'Desde el inicio del mes', tone: 'blue' },
  { label: 'Alertas de inventario', value: '04', detail: 'Requieren revisión', tone: 'amber' },
  { label: 'Seguimientos abiertos', value: '07', detail: '3 vencen esta semana', tone: 'rose' },
] as const;

// Demo-only content keeps the Dashboard visual and independent from the API.
export const demoAppointments: DemoAppointment[] = [
  {
    id: 'demo-1',
    time: '08:30',
    patient: 'Luna',
    owner: 'Camila Rojas',
    service: 'Consulta general',
    status: 'Confirmada',
  },
  {
    id: 'demo-2',
    time: '09:15',
    patient: 'Bruno',
    owner: 'Andrés Gil',
    service: 'Vacunación',
    status: 'En curso',
  },
  {
    id: 'demo-3',
    time: '10:00',
    patient: 'Nala',
    owner: 'Valentina Mora',
    service: 'Control preventivo',
    status: 'Pendiente',
  },
  {
    id: 'demo-4',
    time: '11:30',
    patient: 'Milo',
    owner: 'Sofía Torres',
    service: 'Examen de laboratorio',
    status: 'Confirmada',
  },
];

export const demoPulse = [
  { label: 'Próxima cita', value: '09:15', detail: 'Bruno · Vacunación', tone: 'teal' },
  {
    label: 'Seguimiento prioritario',
    value: '03',
    detail: 'Contactos pendientes hoy',
    tone: 'amber',
  },
  {
    label: 'Caja del día',
    value: '$ 842.000',
    detail: 'Dato ilustrativo, no financiero real',
    tone: 'blue',
  },
] as const;
