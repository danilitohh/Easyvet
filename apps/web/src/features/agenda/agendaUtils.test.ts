import type { AppointmentResponse, OrganizationCurrentResponse } from '@veterinary-saas/contracts';
import { describe, expect, it } from 'vitest';
import {
  AGENDA_VIEWS,
  STATUS_LABELS,
  STATUS_TONES,
  appointmentDurationMinutes,
  appointmentOwnerName,
  addCivilMinutes,
  appointmentProfessionalName,
  appointmentToCalendarEvent,
  civilDateFromDate,
  fallbackRangeForView,
  formatCivilDate,
  instantFromCivil,
  isAgendaView,
  isoAtCivilMidnight,
  nextCivilDate,
  organizationDisplayName,
  viewToFullCalendar,
} from './agendaUtils';

const appointment = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  clinicLocationId: '33333333-3333-4333-8333-333333333333',
  patientId: '44444444-4444-4444-8444-444444444444',
  ownerId: '55555555-5555-4555-8555-555555555555',
  assignedMembershipId: '66666666-6666-4666-8666-666666666666',
  createdByMembershipId: '77777777-7777-4777-8777-777777777777',
  status: 'SCHEDULED',
  startsAt: '2026-09-21T14:00:00.000-05:00',
  endsAt: '2026-09-21T14:45:00.000-05:00',
  reason: 'Vacunación anual',
  notes: 'Traer carnet',
  observations: 'Paciente tranquilo',
  ownerConfirmedAt: null,
  clinicConfirmedAt: '2026-09-20T12:00:00.000-05:00',
  cancelledAt: null,
  cancelledByMembershipId: null,
  cancellationReason: null,
  createdAt: '2026-09-19T12:00:00.000-05:00',
  updatedAt: '2026-09-19T12:00:00.000-05:00',
  patient: {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Luna',
    status: 'ACTIVE',
  },
  owner: {
    id: '55555555-5555-4555-8555-555555555555',
    firstName: 'Ana',
    lastName: 'Pérez',
    status: 'ACTIVE',
  },
  clinicLocation: {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Sede Norte',
    status: 'ACTIVE',
    address: null,
    city: 'Bogotá',
  },
  assignedMembership: {
    id: '66666666-6666-4666-8666-666666666666',
    role: 'VETERINARIAN',
    user: {
      id: '88888888-8888-4888-8888-888888888888',
      email: 'vet@easyvet.test',
      status: 'ACTIVE',
    },
  },
} satisfies AppointmentResponse;

const organization = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Easyvet Norte',
  slug: 'easyvet-norte',
  status: 'ACTIVE',
  timezone: 'America/Bogota',
  locale: 'es-CO',
  currencyCode: 'COP',
} satisfies OrganizationCurrentResponse;

describe('agendaUtils', () => {
  it('exposes all supported calendar views', () => {
    expect(AGENDA_VIEWS).toEqual(['month', 'week', 'day', 'list']);
  });

  it('labels every appointment status in Spanish', () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(6);
    expect(STATUS_LABELS).toMatchObject({
      SCHEDULED: 'Programada',
      WAITING_ROOM: 'En espera',
      IN_PROGRESS: 'En curso',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada',
      NO_SHOW: 'No asistió',
    });
  });

  it('assigns a distinct visual tone to every status', () => {
    expect(new Set(Object.values(STATUS_TONES)).size).toBe(6);
  });

  it('maps an appointment at the calendar boundary', () => {
    const event = appointmentToCalendarEvent(appointment);
    expect(event).toMatchObject({
      id: appointment.id,
      title: 'Luna · Vacunación anual',
      start: appointment.startsAt,
      end: appointment.endsAt,
      classNames: ['agenda-event--scheduled'],
    });
    expect(event.extendedProps).toEqual({ appointment });
  });

  it('calculates duration from offset-aware timestamps', () => {
    expect(appointmentDurationMinutes(appointment)).toBe(45);
  });

  it('formats owner names without losing the first name', () => {
    expect(appointmentOwnerName(appointment)).toBe('Ana Pérez');
  });

  it('uses the assigned professional email in summaries', () => {
    expect(appointmentProfessionalName(appointment)).toBe('vet@easyvet.test');
  });

  it('provides an explicit label for unassigned appointments', () => {
    expect(appointmentProfessionalName({ ...appointment, assignedMembership: null })).toBe(
      'Sin profesional asignado',
    );
  });

  it('accepts only supported URL view values', () => {
    expect(isAgendaView('week')).toBe(true);
    expect(isAgendaView('quarter')).toBe(false);
    expect(isAgendaView(null)).toBe(false);
  });

  it('maps each URL view to its FullCalendar view', () => {
    expect(viewToFullCalendar('month')).toBe('dayGridMonth');
    expect(viewToFullCalendar('week')).toBe('timeGridWeek');
    expect(viewToFullCalendar('day')).toBe('timeGridDay');
    expect(viewToFullCalendar('list')).toBe('listWeek');
  });

  it('reads a civil date in the organization timezone', () => {
    expect(civilDateFromDate(new Date('2026-09-21T04:30:00.000Z'), 'America/Bogota')).toBe(
      '2026-09-20',
    );
  });

  it('converts civil midnight to an instant without browser timezone leakage', () => {
    expect(isoAtCivilMidnight('2026-09-21', 'America/Bogota')).toBe('2026-09-21T05:00:00Z');
  });

  it('advances civil dates one day at a time', () => {
    expect(nextCivilDate('2026-09-30')).toBe('2026-10-01');
  });

  it('builds a Monday-first week range', () => {
    expect(fallbackRangeForView('week', '2026-09-23', 'America/Bogota')).toEqual({
      from: '2026-09-21T05:00:00Z',
      to: '2026-09-28T05:00:00Z',
    });
  });

  it('builds a six-week month range for complete calendar rendering', () => {
    const range = fallbackRangeForView('month', '2026-09-23', 'America/Bogota');
    expect(range.from).toBe('2026-09-01T05:00:00Z');
    expect(range.to).toBe('2026-10-13T05:00:00Z');
  });

  it('builds a one-day range for day view', () => {
    expect(fallbackRangeForView('day', '2026-09-23', 'America/Bogota')).toEqual({
      from: '2026-09-23T05:00:00Z',
      to: '2026-09-24T05:00:00Z',
    });
  });

  it('formats displayed dates using the organization timezone', () => {
    expect(
      formatCivilDate(new Date('2026-09-21T04:30:00.000Z'), 'America/Bogota', {
        dateStyle: 'long',
      }),
    ).toContain('20');
  });

  it('converts local scheduling fields to explicit instants', () => {
    expect(instantFromCivil('2030-01-08', '09:00', 'America/Bogota')).toBe('2030-01-08T14:00:00Z');
    expect(addCivilMinutes('2030-01-08', '09:00', 45)).toEqual({
      date: '2030-01-08',
      time: '09:45',
    });
  });

  it('falls back to a stable organization label when data is unavailable', () => {
    expect(organizationDisplayName(null)).toBe('Organización activa');
    expect(organizationDisplayName(organization)).toBe('Easyvet Norte');
  });
});
