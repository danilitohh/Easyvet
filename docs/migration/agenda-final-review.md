# Revisión final de Agenda — Fase 5D

Esta revisión cierra el hardening de Agenda en Easyvet. Se contrastó el
comportamiento con `docs/migration/agenda-reference.md` y con el checkout
read-only de Lativet en `C:\Users\danil\Downloads\Lativet-reference`, commit
`05fea495cb13208b27bf470b3570987fd501a81e`.

La matriz distingue la conducta observada de las decisiones explícitas de
Easyvet. No se modificó el checkout legacy ni se conectó una base legacy.

## Matriz legacy → Easyvet

| Función legacy                  | Easyvet                                                                  | Estado                      | Nota                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agenda/calendario de citas      | `/agenda` con FullCalendar y eventos tenant-scoped                       | REDISEÑADO INTENCIONALMENTE | Se conserva la agenda autenticada, con `Organization.timezone`, filtros y aislamiento multi-tenant.                                               |
| Vistas mes/semana/día/lista     | Mes, semana, día y lista con URL `view` + fecha civil                    | PRESERVADO                  | La implementación visual cambia de widgets legacy a FullCalendar MIT.                                                                             |
| Scheduler/timeline              | No implementado                                                          | POSTERGADO                  | Requiere una decisión de producto sobre lanes, recursos y horario visible.                                                                        |
| Drag/drop y resize              | Deshabilitados (`editable=false`)                                        | POSTERGADO                  | La reprogramación usa una ruta explícita y validaciones de disponibilidad/conflicto.                                                              |
| Reservas de espacio             | No hay placeholders; se exige Patient y Owner reales                     | REDISEÑADO INTENCIONALMENTE | Se conserva la reserva autenticada como concepto operativo, sin crear una entidad ficticia ni marcadores silenciosos.                             |
| Disponibilidad semanal          | `AvailabilityRule` por sede y Membership opcional, horas civiles `HH:mm` | REDISEÑADO INTENCIONALMENTE | Precedencia Membership > sede; reglas del mismo alcance no pueden solaparse; sin regla activa aplicable = `UNRESTRICTED`.                         |
| Waiting room                    | `Appointment.status = WAITING_ROOM`                                      | PRESERVADO                  | No existe una tabla/cola duplicada.                                                                                                               |
| Confirmación de cita            | `ownerConfirmedAt` y `clinicConfirmedAt` independientes                  | REDISEÑADO INTENCIONALMENTE | Son timestamps UTC; no cambian `AppointmentStatus` ni envían notificaciones. Confirmación manual del propietario queda como decisión de producto. |
| No-show                         | Acción explícita `POST .../no-show` y estado `NO_SHOW`                   | PRESERVADO                  | Es terminal y libera el slot para conflictos futuros.                                                                                             |
| Google Calendar                 | Sin integración ni campos de proveedor en el núcleo                      | POSTERGADO                  | El límite futuro es un adaptador `CalendarProvider` tenant-scoped.                                                                                |
| Recordatorios/WhatsApp/SMS/SMTP | No implementados                                                         | POSTERGADO                  | No se simulan envíos ni estados externos.                                                                                                         |
| Follow-up/consulta clínica      | Sin relación desde Appointment                                           | POSTERGADO                  | ClinicalRecord, Consultation y FollowUp comienzan en fases posteriores.                                                                           |

## Resultado técnico del hardening

- `Appointment` usa una máquina server-side con los estados
  `SCHEDULED → WAITING_ROOM → IN_PROGRESS → COMPLETED` y salidas
  `SCHEDULED/WAITING_ROOM → CANCELLED|NO_SHOW` según el endpoint dedicado.
  `COMPLETED`, `CANCELLED` y `NO_SHOW` son terminales. No existe PATCH genérico
  de estado.
- Las mutaciones de edición, cancelación, confirmación y workflow usan
  compare-and-set por estado. Una solicitud concurrente obsoleta recibe `409`
  y no pisa la acción ganadora.
- Los estados bloqueantes son `SCHEDULED`, `WAITING_ROOM`, `IN_PROGRESS` y
  `COMPLETED`; `CANCELLED` y `NO_SHOW` no bloquean. PostgreSQL aplica exclusión
  por Patient y Membership con rangos half-open `[start, end)`.
- Todos los Appointment mantienen sus FKs compuestas con `organizationId` para
  sede, Patient, Owner, Membership asignada, creadora y canceladora. Los
  detalles y filtros no exponen datos de otro tenant.
- En creación se exige `Patient.ownerId === Appointment.ownerId`; el `ownerId`
  queda como snapshot histórico y no se cambia automáticamente si el Patient
  se reasigna.
- Las reglas de disponibilidad validan referencias activas, horario civil,
  solapamiento dentro del mismo alcance y precedencia. Cambiarlas no muta
  citas existentes.
- Los instantes de citas se guardan en UTC. La autoridad civil es
  `Organization.timezone`; se rechazan horas inexistentes o ambiguas de DST y
  las reglas permanecen como `HH:mm` civil.
- El listado exige límites explícitos y un rango máximo de 90 días. Day/List
  refrescan cada 45 segundos, cancelan peticiones obsoletas y no hacen polling
  de formularios.
- La URL conserva `view`, fecha civil y deep link. Navegar entre vistas/fechas
  crea historial para Atrás/Adelante; el cambio de tenant limpia el detalle,
  filtros y peticiones pendientes.
- El mapeo de eventos FullCalendar está centralizado en `agendaUtils.ts` y no
  añade PII innecesaria al evento. La UI es de solo lectura para drag/drop y
  respeta permisos del backend.

## Matriz de permisos vigente

| Rol               | Agenda y disponibilidad                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------- |
| OWNER / ADMIN     | Lectura, creación, edición, cancelación, lifecycle, no-show y gestión de disponibilidad       |
| VETERINARIAN      | Lectura, creación, edición, check-in, inicio, completado, no-show y lectura de disponibilidad |
| ASSISTANT         | Lectura, creación, edición, check-in y lectura de disponibilidad                              |
| RECEPTION         | Lectura, creación, edición, cancelación, check-in, no-show y lectura de disponibilidad        |
| GROOMER / CASHIER | Solo lectura de Agenda                                                                        |

La matriz no infiere permisos clínicos ni resuelve todavía la política de PII
para GROOMER/CASHIER; ambos temas quedan como `PRODUCT DECISION REQUIRED`.

## Límites y decisiones pendientes

- `Scheduler`, drag/drop, recursos/equipos, excepciones de calendario,
  vacaciones/festivos, recurrencia, Google Calendar, recordatorios, booking
  público, Consultation, ClinicalRecord, Grooming, WebSockets y FollowUp no
  forman parte de Fase 5D.
- La confirmación manual por propietario desde backoffice permanece como
  `PRODUCT DECISION REQUIRED`; la UI actual solo ofrece confirmación clínica.
- El bundle web mantiene el warning conocido de Vite por el chunk de
  FullCalendar (aprox. 775 kB sin comprimir, 228 kB gzip en este cierre).
  Code-splitting de la ruta queda recomendado, no se introduce complejidad de
  bundler/CDN/SSR en esta fase.
- Las citas QA ficticias se conservan en `easyvet_dev`; no se añadió seed ni se
  creó una migración de limpieza.

## Evidencia

La cobertura de regresión incluye estados terminales y confirmaciones,
solapamiento y adyacencia de disponibilidad, precedencia/UNRESTRICTED,
concurrencia de Patient/Membership y lifecycle, aislamiento cross-tenant,
límites de rango, archive de Patient y DST de salto y repetición. Las
validaciones de cierre se registran en `MIGRATION_STATUS.md`.
