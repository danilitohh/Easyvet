# Propuesta de arquitectura de Agenda para Easyvet

## Estado del documento

Este es un diseño de Fase 5A. No crea modelos Prisma, migraciones, endpoints,
contratos, componentes React ni tablas. Las entidades y campos son una propuesta
para implementar después de cerrar las decisiones de producto de
`agenda-decisions.md`.

## Principios de diseño

1. `Organization` es la frontera de tenant. Toda entidad de Agenda lleva
   `organizationId` y toda consulta recibe el tenant desde `TenantContext`, no
   desde el body, query, header o un id enviado por el cliente.
2. Una cita es una reserva operativa; una consulta clínica es un registro de
   atención. No deben ser la misma entidad.
3. `Membership` representa al usuario que actúa como profesional o creador. No
   se crea una tabla `Professional` en 5B.
4. `ClinicLocation` es la sede operativa de una cita interna. La sede no
   sustituye a `Organization` como límite de seguridad.
5. Los instantes se persisten en UTC y se presentan en la zona horaria de la
   organización. Las reglas recurrentes de disponibilidad usan fecha/hora
   civil de la sede y se convierten con una política DST explícita.
6. El backend es la autoridad para permisos, invariantes y conflictos. El
   calendario del frontend solo representa datos ya autorizados.

## Entidades mínimas propuestas para 5B

### 1. `Appointment`

Es la reserva operativa de una atención, visita, llamada o servicio futuro.

| Campo conceptual                                               | Requerido                | Decisión de diseño                                                                                                                                |
| -------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                           | Sí                       | UUID estable; nunca se reutiliza.                                                                                                                 |
| `organizationId`                                               | Sí                       | FK tenant-aware a `Organization`.                                                                                                                 |
| `clinicLocationId`                                             | Sí para 5B interno       | FK compuesto con `organizationId` a `ClinicLocation`; se decide si teleconsulta/llamada puede omitirlo.                                           |
| `patientId`                                                    | Sí en el MVP recomendado | FK compuesto al Patient de la misma organización.                                                                                                 |
| `ownerId`                                                      | Sí en el MVP recomendado | FK compuesto al Owner de la misma organización y debe coincidir con el propietario del paciente. Si se decide derivarlo, no duplicar la relación. |
| `appointmentTypeId`                                            | Sí                       | FK a catálogo `AppointmentType` del mismo tenant.                                                                                                 |
| `assignedMembershipId`                                         | No al crear              | Membership profesional asignada; debe pertenecer a la organización y estar activa.                                                                |
| `createdByMembershipId`                                        | Sí                       | Membership que creó la cita; permite autorización y auditoría mínima.                                                                             |
| `startsAt` / `endsAt`                                          | Sí                       | Instantes UTC; `endsAt > startsAt`. Son la fuente de verdad temporal.                                                                             |
| `status`                                                       | Sí                       | Máquina de estados de `appointment-state-machine.md`.                                                                                             |
| `reason` / `notes`                                             | No                       | Texto operativo acotado; no sustituye historia clínica.                                                                                           |
| `cancelledAt`, `cancelledByMembershipId`, `cancellationReason` | Condicional              | Se rellenan al cancelar y se conservan; no se borra la cita.                                                                                      |
| `createdAt` / `updatedAt`                                      | Sí                       | Auditoría técnica de cambios.                                                                                                                     |

La recomendación de exigir Owner y Patient registrados evita copiar la reserva
rápida placeholder del legado y mantiene las invariantes de Fase 4A/4C. Si el
producto necesita capturar una llamada antes de crear una ficha, debe decidirse
un flujo provisional explícito; no se deben introducir campos anónimos ni crear
entidades ficticias por accidente.

No se guarda `durationMinutes` como segunda fuente de verdad. La duración se
calcula como `endsAt - startsAt`; si la interfaz necesita minutos, es una vista
derivada.

### 2. `AppointmentType`

Catálogo pequeño y configurable por organización para no codificar en un enum
global los tipos de Lativet, cuya lista completa no fue verificable.

| Campo conceptual         | Requerido | Uso                                                                                                                                                  |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `organizationId`   | Sí        | Identidad y aislamiento.                                                                                                                             |
| `code`                   | Sí        | Clave estable por organización; única junto con `organizationId`.                                                                                    |
| `name`                   | Sí        | Etiqueta visible.                                                                                                                                    |
| `systemCategory`         | Sí        | Categoría controlada por código, por ejemplo `CONSULTATION`, `VACCINATION`, `CONTROL`, `GROOMING` o `OTHER`; no representa aún una consulta clínica. |
| `defaultDurationMinutes` | Sí        | Valor inicial de UI; el intervalo enviado al backend sigue siendo autoridad.                                                                         |
| `active`                 | Sí        | Archivado lógico para no romper citas históricas.                                                                                                    |

No se agrega precio, recurso, Google id ni contenido clínico al catálogo de 5B.

### 3. `AvailabilityRule`

Regla recurrente o fechada que describe cuándo se puede iniciar una cita en una
sede y, opcionalmente, para una membership.

| Campo conceptual                           | Requerido          | Uso                                                                                                                             |
| ------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `organizationId`, `clinicLocationId` | Sí                 | Frontera tenant y sede.                                                                                                         |
| `membershipId`                             | No                 | Nulo para disponibilidad de sede; informado para horario de un profesional. Debe ser de la misma organización.                  |
| `dayOfWeek`                                | Para regla semanal | Día civil según la zona de la sede.                                                                                             |
| `effectiveFrom`, `effectiveTo`             | Según regla        | Vigencia civil inclusiva; debe validarse que no se invierta.                                                                    |
| `localStartTime`, `localEndTime`           | Sí                 | Horario local; 5B no acepta intervalos nocturnos que crucen medianoche sin decisión adicional.                                  |
| `slotMinutes`                              | Sí                 | Entre los límites que producto decida; el rango legacy 15–240 se documenta como referencia, no como constraint Easyvet todavía. |
| `active`                                   | Sí                 | Archivado lógico.                                                                                                               |

Si no existe ninguna regla, el comportamiento debe ser una decisión explícita,
no una consecuencia accidental de un `if`. La propuesta segura es “no se
ofrecen slots calculados” hasta que exista una regla, mientras que una cita
creada por un usuario con permiso puede validarse solo por conflicto y horario.

### 4. `ScheduleBlock`

Excepción puntual de la disponibilidad: vacaciones, almuerzo, mantenimiento,
feriado o bloqueo manual. Es opcional para el primer corte, pero se incluye en
el diseño 5B porque sin excepciones una regla semanal no puede representar la
operación real.

| Campo conceptual                           | Requerido | Uso                                       |
| ------------------------------------------ | --------- | ----------------------------------------- |
| `id`, `organizationId`, `clinicLocationId` | Sí        | Tenant y sede.                            |
| `membershipId`                             | No        | Bloqueo de una persona o de toda la sede. |
| `startsAt`, `endsAt`                       | Sí        | UTC; `endsAt > startsAt`.                 |
| `reason`                                   | No        | Motivo operativo no clínico.              |
| `createdByMembershipId`                    | Sí        | Autor y autorización de la excepción.     |
| `createdAt`                                | Sí        | Trazabilidad técnica.                     |

No representa una ausencia laboral legal ni un calendario externo; esas
integraciones quedan fuera.

## Relaciones y claves tenant-aware

```text
Organization
  ├──< ClinicLocation ───< AvailabilityRule
  │          └──────────< ScheduleBlock
  ├──< AppointmentType
  ├──< Appointment >── Patient >── Owner
  │        ├────────── AppointmentType
  │        ├────────── ClinicLocation
  │        └────────── Membership (assigned/created by)
  └──< Membership
```

Las relaciones a Patient, Owner, ClinicLocation, Membership y AppointmentType
deben comprobar `(organizationId, id)` de forma compuesta. Un `findUnique({ id })`
aislado no es válido para una entidad de Agenda.

La recomendación de almacenar `ownerId` además de `patientId` se mantiene solo si
el producto quiere congelar el contexto del responsable al reservar y consultar
permisos sin depender de cambios futuros de propietario. Si Owner siempre se
deriva de Patient y esa relación será inmutable, puede omitirse `ownerId`; la
decisión debe quedar cerrada antes del esquema.

## Profesional, membership y permisos

No se crea `Professional`. Un profesional es una `Membership` activa con la
capacidad correspondiente. La capacidad no debe inferirse únicamente de la
etiqueta visual del rol: debe extenderse el catálogo de permisos existente con
acciones de Agenda, por ejemplo:

- `appointments.read`, `appointments.create`, `appointments.update`;
- `appointments.cancel`, `appointments.confirm`, `appointments.complete`;
- `appointments.manage_availability`.

La matriz de roles y cualquier permiso para reasignar profesional, sede o estado
es decisión de producto. El backend debe comprobar siempre tenant, membership
activa y permiso; `useCan()` solo sirve para UX.

## Patient, Owner y ClinicLocation

### Patient y Owner

Para el MVP interno se recomienda exigir ambos registros existentes, activos y
del mismo tenant. Además, el `ownerId` de la cita debe coincidir con el Owner del
Patient. Esto evita que una combinación de ids válidos de distintas fichas cree
una cita incoherente.

La reserva sin ficha clínica, los datos mínimos de un cliente desconocido y la
conversión de un provisional a Owner/Patient son una decisión de producto
separada. No se resuelven creando placeholders silenciosos.

### ClinicLocation

Una cita interna requiere sede para hacer explícita la operación multi-sucursal,
el timezone de presentación y el futuro inventario de recursos. La sede no es
el único recurso de conflicto: varias consultas pueden compartir sede si la
capacidad lo permite. El modelo de salas/equipos/capacidades se posterga hasta
que exista una decisión de producto.

Si una persona recibe citas pero no tiene cuenta de Easyvet, no debe fabricarse
una membership incompleta en 5B. Ese caso requiere decidir un participante
externo o un recurso profesional separado, con su propio ciclo de vida y
permisos. Hasta esa decisión, `assignedMembershipId` solo acepta memberships
activas de la organización.

## Tiempo, timezone y disponibilidad

- `startsAt` y `endsAt` son instantes UTC, comparables sin ambigüedad.
- `Organization.timezone` (y una eventual zona de `ClinicLocation`) define la
  vista y la interpretación de reglas civiles.
- Las reglas semanales guardan horas locales y día de semana; no guardan un UTC
  fijo porque DST puede cambiarlo.
- Se rechazan intervalos vacíos, invertidos y, inicialmente, intervalos que
  cruzan medianoche sin una semántica aprobada.
- La conversión en DST debe declarar qué hacer con una hora inexistente o
  repetida; no se debe aceptar silenciosamente un desplazamiento.
- Toda búsqueda por día local debe convertir el rango de la sede a UTC antes de
  consultar.

## Disponibilidad, conflictos y sobre-reserva

La disponibilidad dice cuándo puede ofrecerse un slot; no sustituye al control
de conflicto. La creación y reprogramación deben, en una transacción:

1. validar tenant, estado, paciente, sede y membership;
2. convertir el intervalo de la zona operativa a UTC;
3. verificar `AvailabilityRule` y `ScheduleBlock` cuando el flujo los use;
4. comprobar solapamientos de citas no terminales;
5. persistir solo si todo sigue siendo válido.

La regla legacy de bloquear globalmente todas las citas activas no se copia. La
política propuesta es:

- impedir dos citas solapadas para el mismo `assignedMembershipId`;
- impedir dos citas solapadas para el mismo Patient;
- aplicar una política de sede/consultorio/equipo únicamente cuando se haya
  definido una capacidad o recurso concreto;
- permitir citas sin profesional asignado si el producto lo aprueba, pero no
  tratarlas como si reservaran a todos los profesionales.

En PostgreSQL, una exclusión sobre rangos (`tstzrange`) es la defensa más fuerte
para un mismo recurso. Prisma no expresa todas las exclusiones en el schema
declarativo; si se adopta, requerirá SQL de migración revisado y pruebas. Como
alternativa temporal, la aplicación debe bloquear la fila de un recurso o usar
una transacción serializable. Un `check-then-insert` sin bloqueo no evita una
condición de carrera.

## Borrado, archivado y retención

- Las citas no se borran físicamente por una operación normal.
- Cancelar conserva la fila, quién canceló, cuándo y por qué.
- `AppointmentType` y reglas se archivan para no invalidar el historial.
- Un Owner o Patient archivado no debe borrar en cascada las citas históricas;
  las consultas futuras decidirán si se ocultan, se muestran o se bloquean.
- Los eventos de auditoría detallados y la política legal de retención son
  posteriores, pero el diseño no debe impedirlos.

Si Patient u Owner se archiva mientras tiene citas futuras, se conserva la
relación histórica y se muestra al personal autorizado como ficha archivada. No
se crean nuevas reservas ni se reprograma automáticamente; una excepción
administrativa requiere decisión de producto. Esto evita que `archive` se
convierta en un borrado indirecto de Agenda.

## Consultas, filtros y calendario futuro

Los casos de lectura de 5B deben soportar, al menos, rango de fecha local
convertido a UTC, `clinicLocationId`, `assignedMembershipId`, `status`,
`appointmentTypeId`, `patientId` y `ownerId`. La autorización se aplica antes de
devolver filas y los filtros son criterios de búsqueda, no fronteras de
seguridad.

La UI de Fase 5C puede comenzar con vistas día, semana, mes y lista. Drag-and-
drop no es requisito de 5B ni está demostrado en Lativet; si se añade, debe
usar exactamente el caso de uso de reprogramación, con conflicto y auditoría
idénticos a una edición normal.

## Relaciones futuras deliberadamente fuera de 5B

`ClinicalConsultation`, `ClinicalFollowup`, `ControlReminder`, notificaciones,
Google Calendar, reservas públicas, sala de espera avanzada, grooming,
recurrencia, recursos físicos, audit log inmutable y facturación podrán
relacionarse con `Appointment` en fases posteriores. Ninguno debe forzar campos
clínicos, OAuth, correo o JSON polimórfico dentro de la cita inicial.

## Alcance exacto propuesto para Fase 5B

Una vez resueltas las decisiones de producto, 5B debería implementar únicamente:

1. `Appointment`, `AppointmentType`, `AvailabilityRule` y `ScheduleBlock` con
   constraints e índices tenant-aware;
2. contratos de alta, lectura paginada/filtrada, edición de horario y
   cancelación, sin endpoints públicos. Como forma concreta a revisar antes de
   implementar: `GET/POST /api/v1/appointments`,
   `GET/PATCH /api/v1/appointments/:appointmentId`,
   `POST /api/v1/appointments/:appointmentId/confirm`,
   `POST /api/v1/appointments/:appointmentId/start`,
   `POST /api/v1/appointments/:appointmentId/complete`,
   `POST /api/v1/appointments/:appointmentId/cancel`, además de lecturas y
   gestión protegida de `/api/v1/availability-rules` y
   `/api/v1/schedule-blocks`. Son contratos propuestos, no endpoints creados;
   los verbos exactos pueden cambiar al cerrar permisos y estados;
3. permisos server-side y comprobaciones de `Organization`, `Membership`,
   `ClinicLocation`, Owner y Patient;
4. validación UTC/timezone, disponibilidad, bloques y conflictos transaccionales;
5. la máquina de estados de `appointment-state-machine.md`;
6. pruebas de tenant isolation, conflictos, carrera de creación, estados,
   archivado y conversiones de zona horaria;
7. documentación y contratos compartidos necesarios para la futura Fase 5C.

5B no incluye Google Calendar, SMTP, recordatorios, seguimientos, consultas
clínicas, reservas públicas, placeholders, drag-and-drop, calendario visual ni
modificación de Owners/Patients fuera de las claves foráneas necesarias.
