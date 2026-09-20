# Propuesta revisada de arquitectura de Agenda para Easyvet

## Estado del documento

**Checkpoint 5A.1 completado.** La propuesta fue corregida después de leer
directamente Lativet en el commit `05fea495cb13208b27bf470b3570987fd501a81e`.
Los hechos del legado están en
`docs/migration/agenda-reference.md`; este documento describe el diseño nuevo de
Easyvet y no constituye implementación.

Las etiquetas son: **VERIFIED LEGACY BEHAVIOR**, **NEW EASYVET DESIGN DECISION**,
**PRODUCT DECISION REQUIRED** y **POSTPONED**.

## Principios

- Organization es siempre la frontera de aislamiento; toda lectura y escritura
  usa `TenantContext` y relaciones tenant-aware.
- Persistir instantes en UTC y convertir a la zona horaria de la organización;
  no repetir el `appointment_at` local ingenuo del legado.
- Separar reserva operativa de consulta clínica, seguimiento, recordatorio y
  calendario externo.
- Validar invariantes y conflictos en servidor dentro de una transacción; la UI
  solo mejora la experiencia.
- No crear placeholders silenciosos ni copiar el fail-open de autorización del
  legado.

## Modelo mínimo exacto para Fase 5B

### MVP REQUIRED: `Appointment`

**NEW EASYVET DESIGN DECISION** — Un único modelo tenant-scoped con estos campos:

| Campo                                                          | Regla                                                                                                                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `organizationId`                                         | Identidad y frontera tenant; `id` no se reutiliza entre organizaciones.                                                                                                |
| `clinicLocationId`                                             | Requerido para cita presencial si producto confirma esa política; la necesidad para telehealth/teléfono es PRODUCT DECISION REQUIRED.                                  |
| `patientId`, `ownerId`                                         | Recomendación MVP: ambos registros activos y del mismo tenant. Derivar Owner desde Patient o permitir Owner-only es PRODUCT DECISION REQUIRED; no placeholders legacy. |
| `assignedMembershipId`                                         | Nullable para representar profesional; Membership sustituye el texto libre legacy. Permitir “Agenda general” sin membership requiere decisión.                         |
| `createdByMembershipId`                                        | Requerido para actor de creación y trazabilidad operativa.                                                                                                             |
| `typeCode`                                                     | Campo acotado en la cita, opcional hasta cerrar el catálogo. No se crea `AppointmentType` todavía.                                                                     |
| `status`                                                       | Enum Easyvet gobernado por la máquina de `appointment-state-machine.md`, no cadenas arbitrarias.                                                                       |
| `startsAt`, `endsAt`                                           | `DateTime` UTC; `endsAt > startsAt`; duración máxima/mínima será decisión de producto basada en 15–240 legacy.                                                         |
| `reason`                                                       | Requerido, título/motivo visible.                                                                                                                                      |
| `notes`, `observations`                                        | Notas operativas y observaciones separadas; límite de observaciones se fija en contrato.                                                                               |
| `cancelledAt`, `cancelledByMembershipId`, `cancellationReason` | Recomendados para conservar cancelación en lugar de DELETE físico legacy.                                                                                              |
| `createdAt`, `updatedAt`                                       | Auditoría temporal UTC.                                                                                                                                                |

Las FK de Patient, Owner, Location y Membership deben impedir referencias
cross-tenant. La combinación Owner/Patient debe validar que Patient pertenece al
Owner elegido o aplicar la derivación que producto decida.

### MVP condicional: `AvailabilityRule`

**VERIFIED LEGACY BEHAVIOR** confirma que la disponibilidad es necesaria si 5B
ofrece slots. **NEW EASYVET DESIGN DECISION**: implementar solo si el MVP
incluye validación/generación de slots; de ser así, el modelo mínimo es:

`id`, `organizationId`, `clinicLocationId` nullable según sede, `membershipId`
nullable para “general”, `dayOfWeek`, `startLocalTime`, `endLocalTime`,
`slotMinutes`, `active`, `createdAt`, `updatedAt`.

La regla debe ser semanal y tenant-aware. `location` libre y `scope=general`
del legado no son contratos Easyvet. Si producto decide que 5B solo crea citas
sin slots, `AvailabilityRule` se POSTERGA y se documenta como decisión explícita.

## Modelos deliberadamente fuera de 5B

- **POSTPONED — `AppointmentType`**: el legado no tiene columna ni catálogo
  persistido; `typeCode` acotado en Appointment cubre el MVP sin otra tabla.
- **POSTPONED — `ScheduleBlock`**: no se encontró bloqueo, vacaciones,
  almuerzo, incapacidad ni override persistido. Solo se añade cuando exista una
  política de excepciones y una UI que la necesite.
- **POSTPONED**: Google/CalendarProvider, reservas públicas, recurrencia,
  recursos/equipos, waiting-room entity, Consultation, FollowUp, Reminder,
  auditoría legal de versiones, grooming y facturación.

## Tiempo, disponibilidad y conflictos

El intervalo canónico es `[startsAt, endsAt)`. Antes de insertar o reprogramar,
el servidor debe:

1. comprobar Organization y relaciones con FK compuesta;
2. validar `endsAt > startsAt`, zona horaria y límites de duración;
3. validar AvailabilityRule si está habilitada;
4. excluir estados terminales;
5. comprobar conflictos para los recursos decididos (como mínimo profesional,
   Patient y sede/recurso cuando aplique);
6. repetir la comprobación dentro de una transacción con una estrategia
   anti-carrera definida (constraint/exclusion o lock/serialización compatible
   con PostgreSQL).

No se copia el conflicto global de Lativet, que ignoraba profesional, Patient,
Owner, location y busy slots y permitía doble reserva concurrente.

**PRODUCT DECISION REQUIRED**: recursos exactos, comportamiento sin reglas,
excepciones, slots partidos, buffers y si una cita sin profesional ocupa un
recurso de sede.

## Estados, cancelación y reprogramación

La máquina propuesta en `appointment-state-machine.md` es **NEW EASYVET DESIGN
DECISION**, no un enum legacy. Se recomienda conservar una cita cancelada con
motivo/actor/tiempo, no borrar físicamente. Reprogramar cambia el intervalo en
la misma cita y revalida disponibilidad/conflictos; no es DELETE + INSERT.

El legado permite cualquiera de nueve estados sin transición y la UI solo
expone dos; Easyvet debe cerrar esa inconsistencia con endpoints server-side y
pruebas de transición.

## Profesional, Owner/Patient y sede

- `assignedMembershipId` representa la membership activa, no una entidad
  `Professional`. La licencia y el rol se validan en módulos de usuarios.
- Recomendación MVP: Owner y Patient activos y tenant-matched. No se crean
  `Mascota por registrar`, `Reserva agenda` ni `Espacio reservado` como datos de
  dominio.
- `ClinicLocation` es una capacidad existente de Easyvet y una decisión nueva,
  no un campo legacy. Su obligatoriedad para no presenciales es PRODUCT
  DECISION REQUIRED.

## Contrato conceptual de API 5B

Estas son rutas nuevas propuestas, no rutas implementadas ni equivalentes
automáticos de `/api/appointments` legacy:

- `GET /api/v1/appointments` — lista paginada por rango local, estado, Patient,
  Owner, sede, profesional y tipo; siempre tenant-scoped.
- `POST /api/v1/appointments` — crea y valida invariantes/conflictos.
- `GET /api/v1/appointments/:id` — detalle autorizado.
- `PATCH /api/v1/appointments/:id` — edita datos antes de estado terminal o
  atención; reprogramación con la misma transacción.
- `POST /api/v1/appointments/:id/transitions` — transición explícita de estado.
- `GET /api/v1/availability-rules` y `POST /api/v1/availability-rules` —
  reglas activas del tenant.
- `PATCH /api/v1/availability-rules/:id` y
  `DELETE /api/v1/availability-rules/:id` — gestión autorizada.

Permisos sugeridos: `appointments.read`, `appointments.create`,
`appointments.update`, `appointments.confirm`, `appointments.start`,
`appointments.complete`, `appointments.cancel` y
`appointments.manage_availability`. Son diseño, no permisos agregados en 5A.

## Pruebas requeridas antes de cerrar 5B

- FK/consultas cross-tenant devuelven `404` o error estable sin filtrar datos.
- Patient/Owner mismatch, archivado y membership inactiva son rechazados.
- `endsAt > startsAt`, duración, timezone y límites tienen contratos de error.
- Inserción y reprogramación concurrentes no producen doble reserva según la
  estrategia escogida.
- Se prueban conflictos por profesional, Patient, sede/recurso y estados
  terminales.
- Cada transición válida/ inválida de la máquina tiene prueba server-side.
- Cancelación conserva motivo/actor/tiempo y libera el intervalo.
- No se crea Google, booking público, consulta, seguimiento ni placeholder.

## PRODUCT DECISION REQUIRED restante

1. ¿MVP exige Owner y Patient registrados o permite Owner-only/Patient-only?
2. ¿Owner se deriva siempre desde Patient y se ignora un Owner discordante?
3. ¿Se requiere ClinicLocation para toda cita o solo presencial?
4. ¿Puede existir “Agenda general” sin `assignedMembershipId`?
5. ¿Qué `typeCode` iniciales se aceptan y cuándo se necesita catálogo?
6. ¿Qué estados Easyvet son obligatorios y cuál es la tolerancia de `NO_SHOW`?
7. ¿Qué recursos participan en conflicto y qué ocurre sin AvailabilityRule?
8. ¿Se necesitan excepciones/bloques en 5B o se posponen?
9. ¿Cancelación tardía requiere motivo/rol y qué edición permiten terminales?

## Alcance y límite

La Fase 5B solo podrá implementar `Appointment` y, si la decisión de slots lo
confirma, `AvailabilityRule`, sus contratos tenant-aware, permisos, invariantes,
conflictos y pruebas. No incluye UI visual, Google, reservas públicas, bloques,
catálogo de tipos ni integraciones laterales. Este documento no cambia Prisma ni
crea migraciones.
