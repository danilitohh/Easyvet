# Referencia de Agenda de Lativet

## Alcance y calidad de la evidencia

Este documento reconstruye el comportamiento de Agenda para preparar la Fase 5B.
La evidencia disponible en este checkout es la auditoría estática del repositorio
Lativet y sus inventarios de módulos, reglas y modelo de datos. No se encontró el
árbol fuente `Backend/AGENDA` ni `Frontend/AGENDA` dentro de Easyvet, no se abrió
una base legacy y no se ejecutaron sus endpoints. Por tanto:

- los hechos marcados como **confirmados por auditoría** provienen de los
  documentos enumerados abajo;
- los nombres de archivos y rutas legacy son referencias del inventario, no una
  copia ni una dependencia que deba reutilizarse;
- los métodos HTTP, payloads exactos, enumeraciones completas y detalles de
  autorización que no aparecen en la auditoría quedan como **NEEDS REVIEW**.

No se migran datos, secretos, credenciales de Google, tokens, sesiones ni
placeholders con este documento.

## Fuentes consultadas

| Fuente                                | Uso en este análisis                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `docs/migration/MODULE_MAP.md`        | Mapa de Agenda, Reservas, Google Calendar, Consultas, Control y Seguimientos; rutas legacy inventariadas y dependencias. |
| `docs/migration/DATA_MODEL_LEGACY.md` | Tablas, campos conceptuales, relaciones, índices y límites del modelo legacy.                                            |
| `docs/migration/BUSINESS_RULES.md`    | Validaciones de duración, disponibilidad, conflicto, reservas rápidas, controles y sincronización.                       |
| `docs/migration/MIGRATION_RISKS.md`   | Riesgos de disponibilidad, recursos, placeholders, automatizaciones y preguntas abiertas.                                |
| `docs/migration/AUDIT.md`             | Arquitectura monolítica, acoplamientos, Google Calendar, SMTP, bootstrap y dependencias.                                 |
| `docs/migration/SECURITY_AUDIT.md`    | Riesgos de secretos Google/SMTP, callback OAuth, jobs públicos y aislamiento futuro.                                     |
| `docs/architecture/dates.md`          | Convención Easyvet de persistir instantes UTC y presentar en la zona de la organización.                                 |
| `docs/architecture/authorization.md`  | `TenantContext`, permisos server-side, memberships y política fail-closed.                                               |
| `docs/architecture/multi-tenancy.md`  | Organization como frontera de aislamiento y consultas tenant-aware.                                                      |
| `docs/architecture/module-pattern.md` | Secuencia esperada Prisma → API → contratos → UI → pruebas → documentación.                                              |
| `MIGRATION_STATUS.md`                 | Estado de fases y límites ya aceptados por Easyvet.                                                                      |

## Superficie legacy y dependencias

| Área               | Referencia legacy                                                         | Responsabilidad observada                                                                        | Dependencias                                                                                |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Agenda general     | `Frontend/AGENDA/Agenda_general`; `Backend/AGENDA/Agenda_general`         | Calendario, creación/edición, disponibilidad, sala de espera, confirmación y cancelación.        | `appointments`, `agenda_availability_rules`, propietarios, pacientes, usuarios y controles. |
| Reservas           | `Frontend/AGENDA/Reservas`; `Backend/AGENDA/Reservas`                     | Flujo de reserva rápida y orquestación de propietario, paciente y cita.                          | Agenda y registros placeholder.                                                             |
| Integración Google | `Frontend/AGENDA/Integracion_Google`; `Backend/AGENDA/Integracion_Google` | Configurar, conectar, desconectar, consultar ocupación, callback OAuth y sincronizar asistencia. | Citas, URL pública y configuración global; `credentials.json` y `token.json`.               |
| Consultas          | `Backend/CONSULTORIO/Pacientes/Consultas`                                 | Puede derivar una cita de control y actualizar datos clínicos en la misma operación lógica.      | Paciente, propietario, historia, controles y seguimientos.                                  |
| Control            | `Frontend/CONSULTORIO/Pacientes/Control`; backend de Consultas            | Recordatorio/cita de control derivado; la auditoría reporta duración por defecto de 30 minutos.  | Citas, consultas, paciente y propietario.                                                   |
| Seguimientos       | `Frontend/SEGUIMIENTOS`; `Backend/SEGUIMIENTOS`                           | Series de seguimiento, tareas pendientes y correos.                                              | Paciente, consulta, historia, SMTP y job HTTP.                                              |
| Dashboard          | `Frontend/COMPARTIDO/Inicio`; `Backend/COMPARTIDO/Inicio`                 | Agregados operativos que incluyen citas.                                                         | Bootstrap, permisos y múltiples dominios.                                                   |
| Configuración      | `Backend/ADMINISTRACION/Configuracion`                                    | Zona horaria, SMTP, Google y otros ajustes globales.                                             | `settings`, `audit_log` y secretos.                                                         |
| Usuarios/permisos  | `Backend/ADMINISTRACION/Usuarios`                                         | Selector de profesionales y perfiles heredados/granulares.                                       | `staff_users`, permisos y middleware.                                                       |

## Persistencia legacy reconstruida

### `appointments`

La auditoría identifica una tabla de citas con, al menos conceptualmente:

- fecha/hora y duración;
- tipo de cita;
- estado;
- observaciones;
- profesional;
- origen;
- referencias a Google Calendar y a controles;
- claves foráneas a paciente y propietario.

La compatibilidad de propietario y paciente no estaba completamente protegida
por la base; parte de la limpieza y de la consistencia se resolvía manualmente.
No se dispone de un DDL legacy completo para afirmar nombres, nulabilidad,
tipos, enum exacto ni política de borrado de cada columna.

### `agenda_availability_rules`

Representa reglas con fecha o día, hora de inicio, hora de fin y tamaño de
slot. La auditoría confirma que no demuestra un modelo para múltiples recursos
(profesionales, consultorios, equipos o sedes). También queda por verificar si
las reglas son semanales, excepciones o ambas, y qué ocurre con días festivos y
turnos partidos.

### Tablas y relaciones vecinas

| Tabla/artefacto                   | Relación con Agenda                                        | Tratamiento propuesto                                                                                             |
| --------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `owners` / `patients`             | Destino de una cita; Reserva podía crear placeholders.     | Usar las entidades tenant-aware de Easyvet; no crear placeholders automáticamente en 5B sin decisión de producto. |
| `clinical_consultations`          | Registro clínico posterior o cita de control derivada.     | Mantener `Appointment` separado; la consulta será una relación futura.                                            |
| `control_reminders`               | Recordatorios derivados de una consulta/cita.              | Fuera de 5B; requiere job idempotente y política de notificación.                                                 |
| `clinical_followups`              | Seguimientos programados y series de hasta 120 instancias. | Fuera de 5B; no confundir tarea clínica con reserva de agenda.                                                    |
| `settings`                        | Zona horaria, SMTP y Google globales en el legado.         | No reutilizar configuración global como frontera de tenant.                                                       |
| `credentials.json` / `token.json` | Credenciales y token OAuth en archivos locales.            | Nunca importar; integración SaaS requiere almacenamiento cifrado y scoping nuevo.                                 |

## HTTP y operaciones observables

El inventario de módulos confirma operaciones para:

1. crear cita;
2. crear y eliminar disponibilidad;
3. actualizar estado y observaciones;
4. enviar recordatorio;
5. configurar, conectar, desconectar y callback de Google;
6. consultar ocupación y sincronizar asistencia.

La auditoría no conserva el contrato exacto de URL, verbo, parámetros, códigos
de error ni payloads de cada operación. No se debe inferir que el endpoint
legacy equivale a una ruta Easyvet. Esos contratos deben revisarse contra la
fuente Lativet antes de importar comportamiento o diseñar compatibilidad.

La única ruta concreta identificada en la documentación es el job relacionado,
`GET /api/jobs/control-reminders`, que pertenece a Seguimientos y no debe formar
parte de la API de Agenda 5B.

## Validaciones y reglas confirmadas

| Regla                                                                                           | Evidencia                                            | Estado para Easyvet                                                             |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Duración y slot entre 15 y 240 minutos.                                                         | `BUSINESS_RULES.md`, validación de `Agenda_general`. | Confirmada como legado; el límite exacto de producto queda por decidir.         |
| Fin posterior al inicio.                                                                        | `BUSINESS_RULES.md`.                                 | Debe preservarse como invariant de dominio.                                     |
| Si hay reglas, la cita cabe en una regla, se alinea al slot y su duración es múltiplo del slot. | Persistencia/validación legacy inventariada.         | Necesita redefinir zona horaria, recurso y excepciones en SaaS.                 |
| Estados activos excluyen completada, cancelada y no-asistió.                                    | Contexto legacy y Agenda.                            | Debe reemplazarse por la máquina de estados explícita de Easyvet.               |
| El conflicto compara todas las citas activas.                                                   | Persistencia legacy.                                 | No copiar sin decisión: puede bloquear por error todas las sedes/profesionales. |
| Reserva rápida crea propietario/paciente placeholder.                                           | `Backend/AGENDA/Reservas`.                           | Producto debe decidir si permite reserva provisional; no se implementa aún.     |
| Control derivado dura 30 minutos por defecto.                                                   | Persistencia de Consultas/Agenda.                    | Valor legacy, no contrato definitivo de 5B.                                     |
| Un paciente fallecido no recibe recordatorios/seguimientos pendientes.                          | Pacientes y Seguimientos.                            | Regla clínica futura, fuera de Appointment 5B.                                  |

## Estados y comportamiento observado

La evidencia distingue operativamente citas activas de citas completadas,
canceladas y no-asistió, además de flujos de confirmación, sala de espera y
sincronización de asistencia. No existe en los documentos un enum completo ni
una matriz de transiciones verificable. Por eso no se asignan nombres adicionales
como `DRAFT`, `IN_PROGRESS` o `RESCHEDULED` al legado. La propuesta controlada
para Easyvet está en `docs/architecture/appointment-state-machine.md`.

## Clasificación de conceptos del legado

La siguiente clasificación evita convertir cada pantalla o palabra del legado
en una tabla nueva:

| Concepto         | Evidencia legacy                                                                                       | Clasificación para Easyvet                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Appointment      | Tabla `appointments` con fecha/hora, duración, tipo, estado y referencias.                             | **NECESARIO AHORA**; reserva operativa separada de consulta.                          |
| Reservation      | Módulo `AGENDA/Reservas` que orquesta una cita y puede crear placeholders.                             | **LEGACY ESPECÍFICO** como flujo; no crear entidad paralela en 5B.                    |
| AvailabilityRule | Tabla `agenda_availability_rules` con día/fecha, horas y slot.                                         | **NECESARIO AHORA** si 5B ofrece slots; reglas de recursos quedan por definir.        |
| Professional     | Campo/selector de profesional y usuario asociado; no se demuestra tabla independiente.                 | **NECESARIO AHORA** mediante `Membership`; confirmar capacidades.                     |
| Schedule         | No aparece como tabla independiente en la evidencia disponible.                                        | **NO APLICA** como entidad 5B; se representa con reglas y bloques.                    |
| Block            | No se identificó una tabla legacy concluyente para descansos/vacaciones.                               | **NEEDS REVIEW**; `ScheduleBlock` es una recomendación de diseño, no un hecho legacy. |
| Service          | No se identificó un catálogo de servicios de Agenda separado.                                          | **FUTURO**; no mezclar precios/facturación con AppointmentType.                       |
| AppointmentType  | La tabla tiene “tipo”, pero la enumeración exacta no está documentada.                                 | **NECESARIO AHORA** como catálogo por organización, no enum fijo.                     |
| Status           | Hay estados operativos activos, completada, cancelada y no-asistió; el enum exacto no está disponible. | **NECESARIO AHORA** mediante máquina explícita y validada.                            |
| FollowUp         | `clinical_followups` programa tareas y series clínicas.                                                | **FUTURO**; no es una cita por defecto.                                               |
| Reminder         | `control_reminders` y SMTP gestionan recordatorios derivados.                                          | **FUTURO**; módulo Notifications/Reminders separado.                                  |

## Tipos de cita

La auditoría sí confirma el campo `type` en `appointments`, pero no conserva una
lista de valores ni un enum fiable. “Control” y la duración de 30 minutos son
comportamientos de citas derivadas; “consulta”, vacunación, cirugía, laboratorio
y grooming aparecen como módulos clínicos o de servicio, no como una lista
demostrada de `Appointment.type`. Por eso no se afirma que todos sean tipos
legacy de Agenda.

La propuesta de Easyvet es un catálogo `AppointmentType` por organización con una
categoría de sistema pequeña y un nombre configurable. Las categorías iniciales
(por ejemplo `CONSULTATION`, `CONTROL`, `VACCINATION`, `GROOMING`, `SURGERY`,
`LAB`, `OTHER`) son ejemplos para decisión de producto, no un enum que deba
crearse automáticamente.

## Agenda general, personal, filtros y vistas

La evidencia describe un calendario general, selector de profesionales y sala de
espera, pero no demuestra contratos separados para “mi agenda”, agenda por sede
o agenda personal. En Easyvet se deben diseñar filtros tenant-aware por rango de
fecha local, sede, membership asignada, estado, tipo, Patient y Owner; la vista
debe respetar los permisos y no usar el filtro como control de seguridad.

No se encontró evidencia de drag-and-drop en el material auditado. Por tanto no
es requisito de backend ni de la primera UI; si se incorpora, debe llamar al
mismo caso de uso de reprogramación y pasar las mismas validaciones.

La recomendación para Fase 5C es comenzar con vistas día, semana, mes y una lista
operativa; no instalar una librería en Fase 5A.

## Peluquería, seguimiento y reservas públicas

- Peluquería permite ingresos con propietario/paciente o cliente/mascota
  independientes, pero la auditoría no demuestra que cree citas de Agenda. La
  integración futura debe decidir si usa `AppointmentType` de grooming o un
  módulo de ingreso separado.
- Seguimientos y controles pueden derivar citas y consultas sintéticas; no se
  debe añadir `consultationId` ni `followupId` a Appointment 5B sin un caso de
  uso definido.
- No se encontró evidencia concluyente de una reserva pública sin autenticación
  en el material disponible. El flujo `Reservas` observado parece interno y
  crea placeholders. Un booking público se trata como módulo futuro con tenant,
  tokens, rate limits, anti-abuso y consentimiento de PII.

## Borrado de Owner/Patient y citas futuras

La auditoría legacy menciona limpieza manual amplia al borrar un paciente, pero
Easyvet ya usa archive en Owners/Patients y no debe trasladar esa cascada a
Agenda. La política propuesta es conservar una cita histórica; para una cita
futura cuyo Patient u Owner haya sido archivado, la API debe mantener la relación
tenant-safe, mostrar un estado de ficha archivada a usuarios autorizados y
bloquear nuevas reprogramaciones o reservas hasta que producto defina una
excepción. No se cambia esta política en Fase 5A.

## PII y auditoría futura

Agenda solo necesita para operación el nombre identificador de Patient/Owner,
tipo, sede, hora, estado y profesional, sujeto a permisos. GROOMER/CASHIER no
deben recibir historia clínica, notas sensibles, dirección o contacto completo
por defecto; la matriz exacta de permisos sigue `NEEDS REVIEW` y no se amplía
ahora.

Las acciones que deberían auditarse en una fase posterior son creación,
cancelación, reprogramación, cambio de profesional/sede, transición a no-show y
cualquier override de conflicto. No se crea `AuditLog` en esta fase.

## Side effects y acoplamientos

- Guardar consultas puede actualizar paciente, peso, historia, recordatorio,
  seguimiento y cita de control en una misma operación lógica.
- Completar un seguimiento escribe una consulta clínica sintética.
- Los envíos fallidos devuelven recordatorios a pendiente y conservan el error.
- Borrar un paciente en el legado desencadena limpieza manual amplia, incluida
  Agenda; Easyvet no debe convertir `archive` de Patient en borrado de citas.
- Peluquería puede crear una consulta sintética de consentimiento y borrarla al
  eliminar el ingreso.
- Cambios de asistencia pueden escribir en Google Calendar.
- Dashboard, bootstrap y caché legacy mezclan Agenda con PII de otros módulos.

Estos efectos justifican mantener Appointment, Consultation, Followup,
Reminder y Grooming como límites distintos en Easyvet.

## Integraciones externas

### Google Calendar

El legado usa OAuth/Calendar API, callback web, lectura de ocupación y
sincronización de asistencia. Las credenciales y tokens se guardan en archivos
locales globales. La auditoría también advierte que la URL puede derivarse de
`Host`/`X-Forwarded-*`. Para Easyvet se requiere OAuth web con redirect canónico,
state/PKCE cuando corresponda, scopes mínimos, cifrado, revocación, errores
aislados por organización y política explícita de sincronización. Todo ello se
posterga.

### SMTP

SMTP envía recordatorios, seguimientos, documentos y otros mensajes desde una
configuración global. La contraseña puede quedar duplicada en auditoría. Agenda
5B no enviará correo; las notificaciones se diseñarán como un módulo posterior.

## Incertidumbres que bloquean decisiones de producto

1. ¿Una cita exige paciente y propietario registrados o admite una reserva
   provisional sin ficha clínica?
2. ¿El propietario se guarda como relación explícita o se deriva siempre del
   paciente?
3. ¿El recurso de conflicto es profesional, paciente, sede, consultorio,
   equipo, capacidad o una combinación?
4. ¿Una sede comparte agenda y disponibilidad con las demás sedes de la
   organización?
5. ¿Puede una cita no tener profesional asignado al crearla?
6. ¿Qué categorías y tipos de cita son configurables por organización?
7. ¿Qué ocurre cuando una organización no tiene reglas de disponibilidad?
8. ¿Se necesitan turnos partidos, reglas nocturnas, festivos y vacaciones?
9. ¿Quién puede confirmar, cancelar, marcar no-asistencia o reabrir una cita?
10. ¿Se requiere historial formal de reprogramaciones y cambios de recurso?
11. ¿Google será por organización, sede, profesional o calendario/recurso?
12. ¿La reserva pública tendrá tenant, rate limit, anti-abuso y consentimiento
    de PII propios?

## Conclusión de referencia

La Agenda legacy combina calendario, reservas rápidas, disponibilidad, correo,
Google y efectos clínicos. Para Easyvet, la unidad segura debe ser una cita
tenant-scoped, separada de la consulta clínica, con tiempo UTC, recurso de
conflicto explícito y sin copiar secretos ni placeholders de forma automática.
Las decisiones pendientes se consolidan en
`docs/architecture/agenda-decisions.md`.
