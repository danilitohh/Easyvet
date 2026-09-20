# Agenda 5B — contrato operativo

## Alcance

Agenda 5B implementa únicamente `Appointment` y `AvailabilityRule` en el
backend. No incluye UI de calendario, Google Calendar, recordatorios, SMTP,
booking público, Consultation, FollowUp, `AppointmentType` ni `ScheduleBlock`.

## Tiempo

`startsAt` y `endsAt` son `TIMESTAMPTZ(3)` y se normalizan a UTC. Los cuerpos y
queries deben enviar ISO 8601 con `Z` u offset explícito; un timestamp sin
timezone devuelve `VALIDATION_ERROR`. `endsAt` debe ser posterior a `startsAt`.
La zona `Organization.timezone` solo interpreta horas civiles de disponibilidad
y presenta slots; Luxon rechaza horas inexistentes o ambiguas por DST.

## Tenant y relaciones

Todas las operaciones derivan `organizationId` y `createdByMembershipId` desde
`TenantContext`. FK compuestas cubren `(id, organizationId)` para
ClinicLocation, Patient, Owner y Membership. Crear una cita requiere:

- Patient `ACTIVE` del tenant;
- Owner `ACTIVE` del tenant y principal actual del Patient;
- ClinicLocation `ACTIVE` del tenant;
- Membership asignada opcional; si existe, Membership y User `ACTIVE`.

El cliente no puede enviar `organizationId`, `createdByMembershipId`, status,
timestamps de confirmación/cancelación ni timestamps técnicos.

## Estado y confirmación

`AppointmentStatus`: `SCHEDULED`, `WAITING_ROOM`, `IN_PROGRESS`, `COMPLETED`,
`CANCELLED`, `NO_SHOW`. Confirmación vive fuera del status en
`ownerConfirmedAt`/`clinicConfirmedAt`. Las transiciones dedicadas se detallan
en `appointment-state-machine.md`.

## Disponibilidad

`AvailabilityRule` es semanal por sede. `membershipId = null` es regla general;
reglas específicas de Membership tienen precedencia. `dayOfWeek` usa 0 domingo
a 6 sábado. `startLocalTime` y `endLocalTime` son HH:mm, fin posterior, y
`slotMinutes` está entre 15 y 240.

Sin regla aplicable, crear es permitido y slots devuelve `UNRESTRICTED` con lista
vacía. Con reglas, el intervalo debe permanecer dentro de una ventana y el
inicio debe alinearse al slot. La duración de Appointment no se persiste.

## Overlap y concurrencia

El intervalo es half-open `[start, end)`. Bloquean `SCHEDULED`, `WAITING_ROOM`,
`IN_PROGRESS` y `COMPLETED`; `CANCELLED` y `NO_SHOW` no bloquean. Se verifica:

- mismo Patient;
- misma Membership asignada, si existe.

Owner y ClinicLocation no bloquean globalmente. La migración activa `btree_gist`
y crea exclusion constraints sobre `tstzrange(starts_at, ends_at, '[)')` para
Patient y Membership. La comprobación de aplicación mejora el mensaje, pero la
base de datos resuelve carreras concurrentes.

## API

```text
GET    /api/v1/appointments?from=&to=&clinicLocationId=&assignedMembershipId=&patientId=&status=
POST   /api/v1/appointments
GET    /api/v1/appointments/:id
PATCH  /api/v1/appointments/:id              # reason, notes, assignedMembershipId
POST   /api/v1/appointments/:id/reschedule
POST   /api/v1/appointments/:id/cancel
POST   /api/v1/appointments/:id/check-in
POST   /api/v1/appointments/:id/start
POST   /api/v1/appointments/:id/complete
POST   /api/v1/appointments/:id/no-show
POST   /api/v1/appointments/:id/confirm-by-clinic
POST   /api/v1/appointments/:id/confirm-by-owner
GET    /api/v1/availability-rules
POST   /api/v1/availability-rules
PATCH  /api/v1/availability-rules/:id
DELETE /api/v1/availability-rules/:id     # desactivación lógica
GET    /api/v1/agenda/available-slots
```

Las listas limitan el rango a 90 días. El detalle de otro tenant devuelve 404.

## Permisos

El catálogo type-safe contiene `appointments.read/create/update/cancel/checkIn/
start/complete/markNoShow` y `availability.read/manage`. La matriz por rol está
en `agenda-decisions.md`; `PermissionGuard` es la autoridad server-side.

## Archive y futuro

Archivar Patient falla si existen citas futuras bloqueantes con
`PATIENT_HAS_FUTURE_APPOINTMENTS`. Después de cancelar esas citas, el archive es
posible. No se borran citas históricas.

Google, reservas públicas, tipos configurables, bloques y frontend pertenecen a
fases posteriores.

## Migración y rollback

`20260920150000_add_agenda_backend` es una migración forward-only aplicada a
`easyvet_dev` y `easyvet_test`. No modifica migraciones previas ni datos de
Owners/Patients. Un rollback requiere una migración explícita revisada que
elimine las tablas nuevas y sus constraints; no se ejecuta automáticamente para
evitar perder citas.
