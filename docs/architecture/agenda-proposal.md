# Propuesta e implementación de Agenda 5B para Easyvet

## Estado

**FASE 5B IMPLEMENTADA.** Se añadieron `Appointment` y `AvailabilityRule`, su
migración PostgreSQL, contratos, endpoints, permisos, seed y pruebas. No se
implementaron calendario React, Google Calendar, recordatorios, SMTP, reservas
públicas, `AppointmentType` ni `ScheduleBlock`.

La evidencia legacy y el diseño aprobado están en
`docs/migration/agenda-reference.md` y `docs/architecture/agenda.md`.

## Modelo implementado

### `Appointment`

Campos Prisma: `id`, `organizationId`, `clinicLocationId`, `patientId`,
`ownerId`, `assignedMembershipId` nullable, `createdByMembershipId`,
`status`, `startsAt`, `endsAt`, `reason`, `notes`, `observations`,
`ownerConfirmedAt`, `clinicConfirmedAt`, `cancelledAt`,
`cancelledByMembershipId`, `cancellationReason`, `createdAt` y `updatedAt`.

`startsAt`, `endsAt` y los metadatos temporales usan `TIMESTAMPTZ(3)`. No se
persisten `durationMinutes`, Google IDs, `sourceConsultationId` ni `typeCode`.
La duración se calcula como `endsAt - startsAt`.

### `AvailabilityRule`

Campos: `id`, `organizationId`, `clinicLocationId`, `membershipId` nullable,
`dayOfWeek`, `startLocalTime`, `endLocalTime`, `slotMinutes`, `notes`,
`isActive`, `createdAt`, `updatedAt`.

Las horas semanales son `VARCHAR(5)` validado por constraint a `HH:mm`. La sede
es obligatoria; `membershipId = null` representa disponibilidad general de la
sede. Una regla específica de membership tiene precedencia sobre las generales.

## Invariantes

- Organization, ClinicLocation, Patient, Owner, Membership y User deben
  pertenecer al tenant activo y estar en estado operativo requerido.
- Patient y Owner deben estar `ACTIVE` al crear; `patient.ownerId` debe coincidir
  con `ownerId` enviado.
- ClinicLocation es obligatoria y `ACTIVE`.
- `assignedMembershipId` es nullable; cuando existe, Membership y User deben ser
  `ACTIVE`. No se limita a `VETERINARIAN`.
- `createdByMembershipId` proviene únicamente de `TenantContext.membershipId`.
- `endsAt > startsAt`; timestamps sin offset explícito se rechazan.
- Reprogramar solo está permitido para `SCHEDULED` y conserva la cita.
- Cancelar solo está permitido desde `SCHEDULED` o `WAITING_ROOM`; conserva
  motivo, actor y timestamp. No se puede cancelar `IN_PROGRESS`, `COMPLETED` ni
  `NO_SHOW`.

## Estado y confirmación

`AppointmentStatus` implementado: `SCHEDULED`, `WAITING_ROOM`, `IN_PROGRESS`,
`COMPLETED`, `CANCELLED`, `NO_SHOW`.

Confirmación es independiente mediante `ownerConfirmedAt` y
`clinicConfirmedAt`; no existen estados `PENDING_CONFIRMATION` ni
`CONFIRMED_BY_*`.

Transiciones únicas en `AppointmentsService`:

```text
SCHEDULED -> WAITING_ROOM -> IN_PROGRESS -> COMPLETED
SCHEDULED -> IN_PROGRESS
SCHEDULED -> CANCELLED | NO_SHOW
WAITING_ROOM -> CANCELLED | NO_SHOW
```

No hay saltos desde estados terminales. Las acciones son endpoints dedicados;
no existe PATCH genérico de status.

## Tiempo, disponibilidad y slots

La API recibe ISO 8601 con `Z` u offset y normaliza a UTC. Luxon convierte
`Organization.timezone` y rechaza horas civiles inexistentes o ambiguas durante
DST.

Si no hay una regla aplicable, la creación se permite y
`GET /api/v1/agenda/available-slots` devuelve `{ mode: "UNRESTRICTED", slots: [] }`.
Si existen reglas, la cita debe caber completamente, iniciar alineada al
`slotMinutes` y permanecer en una única fecha civil local. `slotMinutes` guía
slots y acepta 15–240; no fija la duración de la cita.

Los slots disponibles devuelven `{ mode: "RULES", timezone, date, slots }` y no
fabrican 24 horas cuando no hay reglas.

## Conflictos y concurrencia

Los estados que bloquean son `SCHEDULED`, `WAITING_ROOM`, `IN_PROGRESS` y
`COMPLETED`. `CANCELLED` y `NO_SHOW` liberan el intervalo. Se bloquea por:

- Patient dentro de la Organization;
- Membership asignada, si no es null.

Owner y ClinicLocation no son recursos de conflicto. Los intervalos usan
semántica half-open `[start, end)`, por lo que citas consecutivas son válidas.

La migración habilita `btree_gist` y crea dos exclusion constraints PostgreSQL
con `tstzrange`: una para Patient y otra para Membership. La consulta previa
solo mejora el error; la constraint es la defensa contra requests concurrentes.

## API implementada

- `GET/POST /api/v1/appointments`
- `GET /api/v1/appointments/:appointmentId`
- `PATCH /api/v1/appointments/:appointmentId` para razón, notas y membership
- `POST /api/v1/appointments/:id/reschedule`
- `POST /api/v1/appointments/:id/cancel`
- `POST /api/v1/appointments/:id/check-in`
- `POST /api/v1/appointments/:id/start`
- `POST /api/v1/appointments/:id/complete`
- `POST /api/v1/appointments/:id/no-show`
- `POST /api/v1/appointments/:id/confirm-by-clinic`
- `POST /api/v1/appointments/:id/confirm-by-owner`
- `GET/POST /api/v1/availability-rules`
- `PATCH/DELETE /api/v1/availability-rules/:ruleId` (DELETE lógico)
- `GET /api/v1/agenda/available-slots`

Las listas exigen `from` y `to` con un rango máximo de 90 días y todos los
identificadores se filtran por `TenantContext`. El detalle cross-tenant responde 404. No se aceptan `organizationId`, status, timestamps de auditoría,
confirmation ni cancellation metadata desde el cliente.

## Permisos y archive

Se añadieron permisos tipados para lectura, creación, actualización,
cancelación, check-in, inicio, completado, no-show y disponibilidad. La matriz
implementada está documentada en `docs/architecture/agenda.md`.

Archivar Patient se bloquea con `PATIENT_HAS_FUTURE_APPOINTMENTS` mientras tenga
citas futuras en estados bloqueantes. Cancelar la cita permite después archivar;
no se cancela automáticamente.

## Fuera de alcance

No se implementaron calendario visual, `AppointmentType`, `ScheduleBlock`,
Reservation, WaitingRoom, Professional, CalendarIntegration, Consultation,
FollowUp, Google, recordatorios, SMTP ni booking público.
