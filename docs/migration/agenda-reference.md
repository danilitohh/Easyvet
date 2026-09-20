# Referencia directa de Agenda de Lativet

## Checkpoint 5A.1

**VERIFIED LEGACY BEHAVIOR** — La Agenda fue inspeccionada directamente en el
checkout read-only de Lativet en:

`C:\Users\danil\Downloads\Lativet-reference`

Commit exacto inspeccionado: `05fea495cb13208b27bf470b3570987fd501a81e`.
El checkout está en `detached HEAD`. No se modificó ni ejecutó Lativet, no se
conectó ninguna base legacy y no se copiaron `.git`, datos, SQLite, `.env` ni
credenciales a Easyvet.

Este documento separa hechos observados de decisiones nuevas de Easyvet:

- **VERIFIED LEGACY BEHAVIOR**: comprobado en código, SQL o pruebas del commit.
- **NEW EASYVET DESIGN DECISION**: diseño tenant-aware que no existe en Lativet.
- **PRODUCT DECISION REQUIRED**: elección que no debe inferirse silenciosamente.
- **POSTPONED**: fuera del alcance de Fase 5B.

## Paths reales revisados

| Área              | Paths inspeccionados                                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Agenda backend    | `Backend/AGENDA/Agenda_general/{persistencia.py,rutas.py,servicios.py,validacion.py,README.md}`                                                                                            |
| Reservas backend  | `Backend/AGENDA/Reservas/{persistencia.py,README.md}`                                                                                                                                      |
| Google backend    | `Backend/AGENDA/Integracion_Google/{google_calendar.py,rutas.py,servicios.py,validacion.py,README.md}`                                                                                     |
| Agenda frontend   | `Frontend/AGENDA/Agenda_general/Logica/interfaz.js`, `Vistas/vistas.html`, `Estilos/estilos.css`, `README.md`, `Recursos/`                                                                 |
| Reservas frontend | `Frontend/AGENDA/Reservas/Logica/interfaz.js`, `Estilos/estilos.css`, `README.md`                                                                                                          |
| Google frontend   | `Frontend/AGENDA/Integracion_Google/Logica/interfaz.js`, `Estilos/estilos.css`, `README.md`                                                                                                |
| Dependencias      | `Backend/BASE_DE_DATOS/{database.py,contexto.py}`, Consultorio/Pacientes/Consultas, Seguimientos, Peluquería, Compartido, Administración/Usuarios, bootstrap y pruebas `Backend/Pruebas/`. |

## `appointments`: DDL y campos exactos

**VERIFIED LEGACY BEHAVIOR** — El DDL de SQLite declara `appointments` así:

| Campo legacy                      | Tipo / nulabilidad                                   | Significado                               | Usado o modificado por                      | Propuesta Easyvet                                                | Estado    |
| --------------------------------- | ---------------------------------------------------- | ----------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------- | --------- |
| `id`                              | `TEXT PRIMARY KEY`, requerido                        | Identidad de la cita                      | Persistencia, rutas, bootstrap              | `id` UUID tenant-aware                                           | PRESERVAR |
| `patient_id`                      | `TEXT NOT NULL`, FK `patients(id)`                   | Paciente                                  | Crear/listar/editar, controles, reservas    | `patientId` + FK compuesta tenant                                | REDISEÑAR |
| `owner_id`                        | `TEXT NOT NULL`, FK `owners(id)`                     | Propietario                               | Crear/listar/editar, reservas               | `ownerId`; derivación y requisito son PRODUCT DECISION REQUIRED  | REDISEÑAR |
| `appointment_at`                  | `TEXT NOT NULL`                                      | Instantánea ISO local ingenua             | Agenda, conflictos, Google                  | `startsAt`/`endsAt` UTC con timezone de organización             | REDISEÑAR |
| `reason`                          | `TEXT NOT NULL`                                      | Título/motivo visible                     | Formulario, Google, controles               | `reason` requerido                                               | PRESERVAR |
| `status`                          | `TEXT NOT NULL`                                      | Estado operativo                          | PATCH de estado, filtros, conflictos        | Enum y máquina server-side                                       | REDISEÑAR |
| `professional_name`               | `TEXT` nullable, texto libre                         | Nombre del profesional o `Agenda general` | Selector, disponibilidad, Google, controles | `assignedMembershipId` nullable; fallback sin cuenta es decisión | REDISEÑAR |
| `duration_minutes`                | `INTEGER NOT NULL DEFAULT 30`                        | Duración; validador 15–240                | Slots, conflictos, Google                   | Derivada de `endsAt` o duración validada                         | REDISEÑAR |
| `notes`                           | `TEXT` nullable                                      | Notas operativas                          | Formulario y Google                         | `notes`                                                          | PRESERVAR |
| `observations`                    | `TEXT` nullable, actualización máxima 500 caracteres | Observación posterior                     | PATCH observations                          | `observations`                                                   | PRESERVAR |
| `created_at` / `updated_at`       | `TEXT NOT NULL`                                      | Auditoría temporal básica                 | Inserción/actualización                     | `DateTime` UTC                                                   | REDISEÑAR |
| `google_event_id`                 | `TEXT` nullable                                      | ID externo de Google                      | Insert/patch/cancel                         | Adaptador externo, no núcleo                                     | POSTERGAR |
| `google_event_url`                | `TEXT` nullable                                      | URL externa                               | Bootstrap/detalle                           | Adaptador externo                                                | POSTERGAR |
| `google_sync_status`              | `TEXT` nullable                                      | Resultado último sync                     | Sync y UI                                   | Adaptador externo con estado propio                              | POSTERGAR |
| `google_sync_error`               | `TEXT` nullable                                      | Último error                              | Sync y UI                                   | Registro de integración futuro                                   | POSTERGAR |
| `google_attendee_response_status` | `TEXT` nullable                                      | Respuesta de invitado Google              | Attendance sync                             | Separado de `status`; futuro                                     | POSTERGAR |
| `source_consultation_id`          | `TEXT` nullable, índice runtime                      | Consulta que originó control              | Consultas, borrado y Google                 | Relación futura cuando exista consulta                           | POSTERGAR |

No existe columna legacy `type`, `starts_at`, `ends_at`, `location`,
`membership_id`, `cancelled_at` ni motivo/actor de cancelación. Todas las
fechas son texto local ingenuo; el esquema no es PostgreSQL.

Índices observados: `appointment_at`, `patient_id`, `owner_id`, `status`,
`(status, appointment_at)` y runtime `source_consultation_id`.

## Disponibilidad real

**VERIFIED LEGACY BEHAVIOR** — `agenda_availability_rules` contiene:

| Campo                       | Tipo / nulabilidad | Comportamiento                                              |
| --------------------------- | ------------------ | ----------------------------------------------------------- |
| `id`                        | `TEXT PRIMARY KEY` | Identidad                                                   |
| `scope`                     | `TEXT NOT NULL`    | Se fuerza a `general` y las consultas filtran por ese valor |
| `professional_name`         | `TEXT NOT NULL`    | Texto libre, por defecto `Agenda general`                   |
| `day_of_week`               | `INTEGER NOT NULL` | 0–6                                                         |
| `start_time` / `end_time`   | `TEXT NOT NULL`    | Hora local; fin debe ser posterior                          |
| `slot_minutes`              | `INTEGER NOT NULL` | Por defecto 30; 15–240                                      |
| `location`                  | `TEXT` nullable    | Texto libre de regla, no de cita                            |
| `notes`                     | `TEXT` nullable    | Nota de regla                                               |
| `created_at` / `updated_at` | `TEXT NOT NULL`    | Tiempos legacy                                              |

Cuando hay reglas, una cita debe caber en una regla, comenzar alineada al slot
y tener una duración múltiplo del slot. Sin reglas, la cita se acepta. El
calendario de 14 días genera slots y marca ocupación; no es otra entidad.

No se encontró tabla de sedes, recursos, vacaciones, almuerzo, incapacidad,
festivos ni overrides. Las “excepciones” de UI solo omiten días al crear reglas
individuales y no se persisten.

## Estados exactos y asistencia

**VERIFIED LEGACY BEHAVIOR** — `APPOINTMENT_STATUSES` contiene exactamente:

`scheduled`, `pending_confirmation`, `waiting_room`, `confirmed`,
`confirmed_by_clinic`, `confirmed_by_owner`, `completed`, `cancelled`,
`no_show`.

`ACTIVE_APPOINTMENT_STATUSES` contiene los seis primeros estados hasta
`confirmed_by_owner`. El backend solo valida pertenencia al conjunto; no aplica
una matriz de transiciones, actor, tiempo, terminalidad ni auditoría completa.

El frontend muestra y permite seleccionar explícitamente solo `scheduled`
(“Agendada”) y `pending_confirmation` (“Por confirmar”); otros valores se
normalizan a `scheduled` en el formulario. `waiting_room` es un estado, no una
entidad ni una cola persistida. `completed`, `cancelled` y `no_show` se tratan
como terminales en la UI.

`google_attendee_response_status` es una respuesta externa independiente. La
función de mapeo devuelve `None`: aceptar/rechazar/necesitar acción en Google no
cambia el `status` manual de la cita.

## Tipos observados

No existe `appointments.type` ni validación backend de tipo. El frontend ofrece
exactamente: `Reserva de espacio`, `Consulta`, `Vacunacion`, `Desparasitacion`,
`Cirugia / procedimiento`, `Laboratorio`, `Imagen diagnostica`, `Seguimiento`
(etiquetado “Control”), `Peluquería` y `Otro`. Serializa `appointment_type`,
pero backend lo ignora y, cuando aplica, antepone el texto a `reason`.

Por tanto, esos valores son **OBSERVADO EN LATIVET (frontend solamente)**, no un
enum persistido. Un `typeCode` acotado en Easyvet es **NEW EASYVET DESIGN
DECISION**; un catálogo `AppointmentType` separado queda **POSTPONED**.

## Reservas y Owner/Patient

**VERIFIED LEGACY BEHAVIOR** — Reservas no es una tabla ni endpoint público
separado. El checkbox “Solo reservar espacio” usa el mismo `POST /api/appointments`
con `reserve_only=true`. El flujo crea o reutiliza:

- Owner marcador: `Reserva agenda`.
- Patient marcador: `Espacio reservado`, especie `Otros`, raza `Reserva`, sexo y
  estado reproductivo `No aplica`, edad/peso cero y nota de marcador.

Los listados normales ocultan esos marcadores. No hay expiración, aprobación,
link anónimo, rate limit ni booking público. Requiere el flujo autenticado
interno y guarda una fila de `Appointment` con IDs marcador.

La matriz real es:

| Entrada           | Resultado                                                                   |
| ----------------- | --------------------------------------------------------------------------- |
| Owner + Patient   | Cita normal; el Owner persistido se corrige al `owner_id` real del Patient. |
| Owner sin Patient | Se crea Patient placeholder `Mascota por registrar`.                        |
| Patient sin Owner | Se deriva Owner desde el Patient.                                           |
| Sin Owner/Patient | Solo válido con `reserve_only`, usando marcadores.                          |
| Reserva previa    | No hay entidad previa: la propia fila es una reserva provisional.           |

Aunque las columnas SQL son NOT NULL, no todos los flujos requieren registros
de dominio reales. Easyvet debe decidir explícitamente si el MVP exige Owner y
Patient registrados; la recomendación es sí y sin placeholders silenciosos.

## Profesional y ubicación

El legado solo guarda `professional_name` como texto libre. El selector se
construye desde `staff_users` y también permite el fallback `Agenda general`;
no se guarda user ID, rol ni licencia. **NEW EASYVET DESIGN DECISION**:
`assignedMembershipId` nullable y `createdByMembershipId` para auditoría. Si una
cita puede quedar sin profesional, es **PRODUCT DECISION REQUIRED**.

No hay `ClinicLocation`, consultorio, sala ni recurso en `appointments`.
`location` existe únicamente en una regla de disponibilidad. `ClinicLocation`
obligatorio para citas presenciales es diseño nuevo de SaaS; telehealth/teléfono
requiere decisión de producto.

## Conflictos y carrera

La validación recorre todas las citas y considera activas solo las seis
`ACTIVE_APPOINTMENT_STATUSES`. Detecta solapamiento por intervalo de inicio más
duración, sin filtrar por profesional, paciente, owner, sede, sala, recurso ni
busy slots de Google. No existe constraint de exclusión, lock de fila ni
transacción serializable; una carrera de doble reserva permanece posible.

Esto es comportamiento verificado, no una regla que deba copiarse. Easyvet
necesita una política explícita de recursos y una protección transaccional.

## Integraciones laterales

### Consultas, controles y seguimientos

`save_consultation` puede crear/actualizar una cita de control con
`source_consultation_id`, el Patient de la consulta, `scheduled` como estado
inicial (o conserva un estado activo), duración 30, profesional de la consulta
o `Agenda general`, y razón `Vacunacion`, `Desparasitacion` o `Control` más el
nombre del paciente. `next_control_at` conserva hora; `next_control` usa
09:00. Quitar el próximo control o borrar la consulta elimina físicamente la
cita enlazada (cancelando Google antes si aplica). Seguimientos son tareas
clínicas separadas; completar uno crea una consulta sintética, no una cita por
defecto.

### Peluquería

No se observaron llamadas de Peluquería a Agenda ni creación de appointments en
este commit. Sus documentos tienen `service_at`, `next_visit_at` y
`stylist_name`, pero no integran el calendario. Cualquier integración es
**POSTPONED**.

### Google Calendar

**VERIFIED LEGACY BEHAVIOR**:

- OAuth usa `calendar.events`; credenciales y token se guardan en archivos de
  configuración local y secretos globales (`credentials.json`, `token.json`).
- Guardar/actualizar una cita crea o parchea un evento; borrar/cancelar lo marca
  cancelado externamente y después elimina físicamente la fila local.
- Summary, descripción, paciente, owner, motivo, profesional y notas se envían
  a Google. Inicio/fin se calculan con duración y `agenda_timezone` (por defecto
  `America/Bogota`); el email del owner puede ser attendee.
- `busy-slots` consulta eventos no cancelados, pero no participa en la
  validación local de conflictos.
- Attendance sync persiste la respuesta del attendee y no altera `status`.

La integración SaaS queda fuera de 5B y deberá usar un adaptador
`CalendarProvider`, almacenamiento cifrado y credenciales tenant-scoped.

## Rutas reales

**VERIFIED LEGACY BEHAVIOR**:

`POST /api/appointments`, `POST /api/availability`,
`DELETE /api/availability/<rule_id>`,
`PATCH /api/appointments/<appointment_id>/status`,
`PATCH /api/appointments/<appointment_id>/observations`,
`POST /api/appointments/<appointment_id>/reminder`,
`DELETE /api/appointments/<appointment_id>`, y alias
`POST /api/appointments/<appointment_id>/delete`.

El bootstrap entrega la lista; no hay GET individual de cita. Las rutas de
appointment/availability requieren autorización cuando el módulo de
Administración está activo, aunque el legado puede fallar abierto si la
configuración administrativa no existe. No se copia ese comportamiento.

## Frontend real

La UI custom ofrece `Mes`, `Semana`, `Día`, `Lista` y `Programador`; la vista
por defecto es día y se guarda en localStorage. El timeline usa 06:00–21:00,
snap de 15 minutos y datos de `agenda_calendar`. El modal permite buscar Owner y
Patient, registro rápido, reserva de espacio, tipo frontend, profesional,
inicio/fin o duración 15–240, razón, notas y los dos estados visibles. Hay
detalle con observaciones, recordatorio WhatsApp, navegación al paciente,
reprogramación y borrado físico. Drag/drop existe: abre el modal de
reprogramación y guarda por el mismo upsert, sin endpoint especial ni lanes por
recurso. Auto-refresh cada 30 segundos. No usa FullCalendar ni React Big
Calendar y no hay booking público.

## Diferencias que corrigen la propuesta preliminar de Fase 5A

- La fuente ya no es “no disponible”: fue verificada en el commit exacto.
- El enum legacy sí es conocido y contiene nueve valores; no había que inventar
  nombres sin fuente.
- No hay `AppointmentType` persistido ni catálogo demostrado.
- Owner/Patient son NOT NULL en SQL, pero placeholders, Patient-only y reserva
  marcador permiten flujos incompletos; no se debe afirmar “ambos registrados”
  como hecho legacy.
- No hay `ScheduleBlock`, location de cita ni profesional como entidad.
- No hay integración observada Peluquería→Agenda.
- La reserva legacy es interna y provisional, no public booking.
- Cancelar/borrar es DELETE físico, mientras Easyvet propone conservar
  `CANCELLED` como rediseño.

## Gate de diseño para Easyvet

**NEW EASYVET DESIGN DECISION**: el modelo mínimo revisado y el alcance de 5B
están en `docs/architecture/agenda-proposal.md`. **PRODUCT DECISION REQUIRED**
permanece para Owner/Patient registrado y derivación de Owner, ubicación para
telehealth, citas sin profesional, matriz final de estados, conflictos por
recurso, comportamiento sin reglas, excepciones, código de tipo y política de
cancelación/reprogramación.

No se implementa Agenda en este checkpoint.
