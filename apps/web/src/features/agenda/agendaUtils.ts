import 'temporal-polyfill/global';
import { Temporal } from 'temporal-polyfill';
import type {
  AppointmentResponse,
  AppointmentStatusValue,
  OrganizationCurrentResponse,
} from '@veterinary-saas/contracts';
import type { EventInput } from '@fullcalendar/react';

export const AGENDA_VIEWS = ['month', 'week', 'day', 'list'] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export const STATUS_LABELS: Record<AppointmentStatusValue, string> = {
  SCHEDULED: 'Programada',
  WAITING_ROOM: 'En espera',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'No asistió',
};

export const STATUS_TONES: Record<AppointmentStatusValue, string> = {
  SCHEDULED: 'scheduled',
  WAITING_ROOM: 'waiting',
  IN_PROGRESS: 'progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no-show',
};

export type AgendaFilters = {
  clinicLocationId: string;
  assignedMembershipId: string;
  patientId: string;
  status: AppointmentStatusValue | 'ALL';
};

export function appointmentOwnerName(appointment: AppointmentResponse): string {
  return [appointment.owner.firstName, appointment.owner.lastName].filter(Boolean).join(' ');
}

export function appointmentProfessionalName(appointment: AppointmentResponse): string {
  return appointment.assignedMembership?.user.email ?? 'Sin profesional asignado';
}

// CalendarEvent is the single mapping boundary between backend appointments and FullCalendar.
export function appointmentToCalendarEvent(appointment: AppointmentResponse): EventInput {
  return {
    id: appointment.id,
    title: `${appointment.patient.name} · ${appointment.reason}`,
    start: appointment.startsAt,
    end: appointment.endsAt,
    classNames: [`agenda-event--${STATUS_TONES[appointment.status]}`],
    extendedProps: { appointment },
  };
}

export function appointmentDurationMinutes(appointment: AppointmentResponse): number {
  return Math.max(
    0,
    Math.round((Date.parse(appointment.endsAt) - Date.parse(appointment.startsAt)) / 60_000),
  );
}

export function isAgendaView(value: string | null): value is AgendaView {
  return Boolean(value && AGENDA_VIEWS.includes(value as AgendaView));
}

export function viewToFullCalendar(
  view: AgendaView,
): 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek' {
  if (view === 'week') return 'timeGridWeek';
  if (view === 'day') return 'timeGridDay';
  if (view === 'list') return 'listWeek';
  return 'dayGridMonth';
}

export function formatCivilDate(
  date: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    ...options,
  }).format(date);
}

export function civilDateFromDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isoAtCivilMidnight(date: string, timezone: string): string {
  const zoned = Temporal.PlainDate.from(date).toZonedDateTime({
    timeZone: timezone,
    plainTime: '00:00',
  });
  return zoned.toInstant().toString();
}

export function nextCivilDate(date: string): string {
  return Temporal.PlainDate.from(date).add({ days: 1 }).toString();
}

export function fallbackRangeForView(
  view: AgendaView,
  date: string,
  timezone: string,
): { from: string; to: string } {
  const startDate = Temporal.PlainDate.from(date);
  const start =
    view === 'month'
      ? startDate.with({ day: 1 })
      : view === 'week'
        ? startDate.subtract({ days: startDate.dayOfWeek - 1 })
        : startDate;
  const days = view === 'month' ? 42 : view === 'week' || view === 'list' ? 7 : 1;
  const end = start.add({ days });
  return {
    from: isoAtCivilMidnight(start.toString(), timezone),
    to: isoAtCivilMidnight(end.toString(), timezone),
  };
}

export function organizationDisplayName(organization: OrganizationCurrentResponse | null): string {
  return organization?.name ?? 'Organización activa';
}
