# Decisiones de Agenda

## Estado del checkpoint 5A.1

La fuente legacy de Agenda fue verificada directamente en el commit
`05fea495cb13208b27bf470b3570987fd501a81e`, en un checkout read-only fuera de
Easyvet. No se ejecutó el backend legacy ni se conectó una base. La evidencia
detallada está en `docs/migration/agenda-reference.md`.

Las etiquetas de este registro son **VERIFIED LEGACY BEHAVIOR**, **NEW EASYVET
DESIGN DECISION**, **PRODUCT DECISION REQUIRED** y **POSTPONED**.

## DECIDIDO

1. No se modifica `prisma/schema.prisma`, migraciones, endpoints, permisos ni
   frontend en el checkpoint 5A.1.
2. Fase 5B no inicia hasta resolver las decisiones de producto bloqueantes.
3. Organization es la frontera de aislamiento; toda API futura será
   tenant-aware y deny-by-default.
4. Easyvet persistirá instantes UTC y presentará la zona horaria de la
   Organization; no copiará `appointment_at` local ingenuo.
5. Appointment será reserva operativa separada de Consultation, FollowUp,
   Reminder y calendario externo.
6. La cancelación Easyvet conservará la fila y su motivo/actor/tiempo; no se
   copiará el DELETE físico de Lativet.
7. No se creará una entidad `WaitingRoom`: el legacy la representa como estado
   `waiting_room` y una vista operativa.
8. Google queda fuera de 5B detrás de un futuro `CalendarProvider`; no se
   copiarán credenciales, IDs ni archivos locales al núcleo.
9. El resultado de asistencia de Google seguirá separado del estado de
   Appointment.
10. No se inventará integración Peluquería→Agenda: no fue observada en el
    commit revisado.
11. El checkout Lativet se mantiene fuera de Easyvet, detached y sin commits.

## VERIFIED LEGACY BEHAVIOR que condiciona el diseño

- `appointments` requiere SQL `patient_id` y `owner_id`, pero permite
  Owner-only mediante Patient placeholder, Patient-only derivando Owner y
  `reserve_only` mediante Owner/Patient marcador. Por tanto, “ambos registros
  reales siempre” no es un hecho legacy.
- Los nueve estados exactos son `scheduled`, `pending_confirmation`,
  `waiting_room`, `confirmed`, `confirmed_by_clinic`, `confirmed_by_owner`,
  `completed`, `cancelled` y `no_show`; el backend no impone transiciones.
- No hay columna `type`, catálogo `AppointmentType`, `ClinicLocation`,
  `ScheduleBlock`, membership ni ubicación de Appointment.
- `agenda_availability_rules` sí existe, pero es semanal, scope `general`, texto
  libre de profesional y sin overrides persistidos.
- El conflicto legacy es global entre citas activas y susceptible a carrera;
  no filtra por profesional, Patient, sede, recurso o busy slots de Google.
- Reservas son internas y provisionales dentro de `/api/appointments`, no public
  booking ni una entidad `Reservation`.
- Controles derivados desde Consultation enlazan `source_consultation_id` y
  pueden borrarse físicamente al quitar el próximo control.

## NEW EASYVET DESIGN DECISION

### Modelo mínimo de 5B

Se recomienda implementar únicamente:

- `Appointment` tenant-scoped con Patient/Owner, `ClinicLocation` según la
  política presencial, `assignedMembershipId` nullable,
  `createdByMembershipId`, `typeCode` acotado, estado canónico, `startsAt`,
  `endsAt`, razón, notas, observaciones, timestamps y metadatos de cancelación.
- `AvailabilityRule` solo si el MVP implementa slots y validación de
  disponibilidad; tenant-aware, por sede/membership opcional y horarios locales.

`AppointmentType` y `ScheduleBlock` no son requisitos automáticos. No se crean
solo porque aparecían en la propuesta preliminar.

### Límites de identidad

- Recomendación: Owner y Patient activos, del mismo tenant, y sin placeholders.
- `assignedMembershipId` reemplaza `professional_name`; no se crea
  `Professional`.
- `ClinicLocation` es capacidad nueva de SaaS. Su obligación en telehealth o
  teléfono es PRODUCT DECISION REQUIRED.
- No se vinculan Consultation/FollowUp en Prisma 5B sin un caso de uso y
  módulo clínico implementado.

### Disponibilidad y conflicto

La API validará intervalos UTC, reglas semanales y conflictos dentro de una
transacción con estrategia anti-carrera PostgreSQL. Los recursos exactos,
comportamiento sin reglas y excepciones quedan en decisión de producto.

### Máquina y API

La máquina de `appointment-state-machine.md` es diseño nuevo; las rutas nuevas
propuestas son `/api/v1/appointments`, `/api/v1/appointments/:id`,
`/api/v1/appointments/:id/transitions` y `/api/v1/availability-rules`.
No son rutas implementadas en 5A ni compatibilidad automática con el legacy.

## PRODUCT DECISION REQUIRED

1. ¿El MVP exige Owner + Patient registrados, o admite Owner-only/Patient-only?
2. ¿Owner se deriva siempre desde Patient y cómo se rechaza un mismatch?
3. ¿`ClinicLocation` es obligatorio para todas las citas o solo presenciales?
4. ¿Puede existir una cita sin membership asignada (`Agenda general`)?
5. ¿Qué `typeCode` iniciales se soportan y cuándo se justifica catálogo?
6. ¿Qué estados Easyvet son obligatorios y cuál es la tolerancia de `NO_SHOW`?
7. ¿Qué recursos producen conflicto y cómo se protege la concurrencia?
8. ¿Qué ocurre cuando no hay AvailabilityRule? ¿Se requieren bloques/excepciones
   en 5B?
9. ¿Cancelación tardía exige motivo/rol? ¿Se permite corregir estados terminales?
10. ¿Qué permisos de profesional permiten confirmar, iniciar y completar?

## POSTERGADO

- Google Calendar, OAuth, busy slots, webhooks y attendance sync.
- `AppointmentType` como tabla/catálogo; servicios, precios y facturación.
- `ScheduleBlock`, vacaciones, almuerzo, incapacidad y festivos.
- Reservas públicas, links anónimos, captcha/rate limit y consentimiento PII.
- Recurrencia, generación masiva, consultorios/equipos y capacidad avanzada.
- Waiting-room entity, Consultation/FollowUp/Reminder y grooming.
- Auditoría legal/versionado completo de reprogramaciones.
- UI React de calendario, drag/drop y filtros avanzados (Fase 5C).

## Criterio de salida de Fase 5A

El análisis y diseño de Agenda queda **COMPLETADO** porque la fuente directa,
los paths, campos, estados, reservas, dependencias y diferencias ya están
verificados y documentados. El estado de backend sigue **PENDIENTE FASE 5B**;
resolver las decisiones de producto anteriores es condición de inicio. Este
checkpoint se detiene aquí.
