import { useCallback, useEffect, useRef, useState } from 'react';
import FullCalendar, {
  type CalendarApi,
  type CalendarRef,
  type DatesSetInfo,
  type EventClickInfo,
  type EventInput,
} from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import listPlugin from '@fullcalendar/react/list';
import esLocale from '@fullcalendar/react/locales/es';
import breezyTheme from '@fullcalendar/react/themes/breezy';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/breezy/theme.css';
import '@fullcalendar/react/themes/breezy/palettes/emerald.css';
import type { AppointmentResponse } from '@veterinary-saas/contracts';
import {
  civilDateFromDate,
  STATUS_LABELS,
  type AgendaView,
  viewToFullCalendar,
} from './agendaUtils';

type AgendaCalendarProps = {
  view: AgendaView;
  date: string;
  timezone: string;
  events: EventInput[];
  loading: boolean;
  onRangeChange: (range: { from: string; to: string }, view: AgendaView, date: string) => void;
  onOpenAppointment: (appointmentId: string) => void;
  onViewChange: (view: AgendaView) => void;
};

function agendaViewFromFullCalendar(value: string): AgendaView {
  if (value === 'timeGridWeek') return 'week';
  if (value === 'timeGridDay') return 'day';
  if (value === 'listWeek') return 'list';
  return 'month';
}

function eventAppointment(
  info: EventClickInfo | { event: { extendedProps: Record<string, unknown> } },
) {
  return info.event.extendedProps.appointment as AppointmentResponse | undefined;
}

// Calendar keeps navigation controls outside the vendor toolbar so URL state and keyboard labels stay explicit.
export function AgendaCalendar({
  view,
  date,
  timezone,
  events,
  loading,
  onRangeChange,
  onOpenAppointment,
  onViewChange,
}: AgendaCalendarProps) {
  const calendarRef = useRef<CalendarRef>(null);
  const lastRangeRef = useRef<string | null>(null);
  const [title, setTitle] = useState('');
  const currentView = viewToFullCalendar(view);

  const syncCalendar = useCallback((action: (api: CalendarApi) => void) => {
    const api = calendarRef.current?.getApi();
    if (api) action(api);
  }, []);

  useEffect(() => {
    syncCalendar((api) => {
      if (api.view.type !== currentView) api.changeView(currentView, date);
      else api.gotoDate(date);
    });
  }, [currentView, date, syncCalendar]);

  const datesSet = useCallback(
    (info: DatesSetInfo) => {
      const nextView = agendaViewFromFullCalendar(info.view.type);
      const nextDate = civilDateFromDate(info.view.currentStart, timezone);
      const rangeSignature = `${info.startStr}|${info.endStr}|${nextView}|${nextDate}`;
      if (lastRangeRef.current === rangeSignature) return;
      lastRangeRef.current = rangeSignature;
      setTitle(info.view.title);
      onRangeChange({ from: info.startStr, to: info.endStr }, nextView, nextDate);
    },
    [onRangeChange, timezone],
  );

  const eventContent = useCallback(
    (info: { event: { extendedProps: Record<string, unknown> } }) => {
      const appointment = eventAppointment(info);
      if (!appointment) return <span>{info.event.extendedProps.title as string}</span>;
      return (
        <div className="agenda-event-content">
          <span className="agenda-event-content__status">{STATUS_LABELS[appointment.status]}</span>
          <strong>{appointment.patient.name}</strong>
          <small>{appointment.reason}</small>
        </div>
      );
    },
    [],
  );

  const eventClick = useCallback(
    (info: EventClickInfo) => {
      info.jsEvent.preventDefault();
      onOpenAppointment(info.event.id);
    },
    [onOpenAppointment],
  );

  return (
    <section className="agenda-calendar-shell" aria-label="Calendario de citas">
      <div className="agenda-calendar-toolbar">
        <div className="agenda-calendar-toolbar__navigation">
          <button
            className="icon-button"
            type="button"
            aria-label="Período anterior"
            onClick={() => syncCalendar((api) => api.prev())}
          >
            ‹
          </button>
          <button
            className="button button--secondary button--compact"
            type="button"
            onClick={() => syncCalendar((api) => api.today())}
          >
            Hoy
          </button>
          <button
            className="icon-button"
            type="button"
            aria-label="Período siguiente"
            onClick={() => syncCalendar((api) => api.next())}
          >
            ›
          </button>
        </div>
        <h2 className="agenda-calendar-toolbar__title" aria-live="polite">
          {title}
        </h2>
        <div className="agenda-view-switcher" role="group" aria-label="Vista de agenda">
          {(
            [
              ['month', 'Mes'],
              ['week', 'Semana'],
              ['day', 'Día'],
              ['list', 'Lista'],
            ] as const
          ).map(([value, label]) => (
            <button
              className={
                value === view
                  ? 'agenda-view-switcher__button is-active'
                  : 'agenda-view-switcher__button'
              }
              type="button"
              aria-pressed={value === view}
              key={value}
              onClick={() => {
                onViewChange(value);
                syncCalendar((api) => api.changeView(viewToFullCalendar(value), date));
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className={loading ? 'agenda-calendar is-loading' : 'agenda-calendar'}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, breezyTheme]}
          initialView={currentView}
          initialDate={date}
          timeZone={timezone}
          locale={esLocale}
          locales={[esLocale]}
          headerToolbar={false}
          events={events}
          editable={false}
          selectable={false}
          eventStartEditable={false}
          eventDurationEditable={false}
          eventResizableFromStart={false}
          eventOverlap={false}
          eventDisplay="block"
          nowIndicator
          dayMaxEvents={3}
          weekends
          firstDay={1}
          allDaySlot={false}
          height={view === 'month' || view === 'list' ? 'auto' : 690}
          contentHeight={view === 'month' || view === 'list' ? 'auto' : 640}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          datesSet={datesSet}
          eventClick={eventClick}
          eventContent={eventContent}
          eventDidMount={(info) => {
            const appointment = eventAppointment(info);
            if (appointment) {
              info.el.setAttribute(
                'aria-label',
                `${appointment.patient.name}, ${STATUS_LABELS[appointment.status]}, ${appointment.reason}`,
              );
            }
          }}
        />
        {loading ? (
          <div className="agenda-calendar-loading" role="status">
            <span className="agenda-calendar-loading__bar" />
            <span className="agenda-calendar-loading__bar agenda-calendar-loading__bar--short" />
            <span className="sr-only">Cargando citas</span>
          </div>
        ) : null}
      </div>
      <p className="agenda-calendar-hint">
        Haz clic en una cita para consultar su detalle. La agenda es de solo lectura.
      </p>
      <span className="sr-only">
        Fecha actual: {date}. Zona horaria: {timezone}.
      </span>
    </section>
  );
}
