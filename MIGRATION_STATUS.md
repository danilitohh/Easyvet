# Estado de migración

| Área                              | Estado                                                         |
| --------------------------------- | -------------------------------------------------------------- |
| Auditoría legacy                  | Completada                                                     |
| Monorepo                          | Completado                                                     |
| React/Vite                        | App shell y base visual de Fase 2 completados                  |
| NestJS                            | Infraestructura; Nest 12.0.3 verificado                        |
| PostgreSQL                        | VERIFICADO LOCALMENTE                                          |
| Prisma                            | Modelos Fases 3A/3B/4A/5B y migraciones aplicados localmente   |
| Core tenant model                 | COMPLETADO (Fase 3A)                                           |
| Multi-tenancy                     | Fundación de aislamiento completada (Fase 3C)                  |
| Autenticación                     | COMPLETADA (Fase 3B)                                           |
| Autorización                      | COMPLETADA (Fase 3C)                                           |
| UI Lativet                        | Referencia analizada; adaptación React completada              |
| Owners backend                    | COMPLETADO (Fase 4A)                                           |
| Patients backend                  | COMPLETADO (Fase 4A)                                           |
| Owners frontend                   | COMPLETADO (Fase 4B)                                           |
| Patients frontend                 | COMPLETADO (Fase 4B)                                           |
| Owners/Patients final review      | COMPLETADO (Fase 4C)                                           |
| Agenda analysis/design            | COMPLETADO (Fase 5A)                                           |
| Agenda backend                    | COMPLETADO (Fase 5B)                                           |
| Agenda frontend read-only         | COMPLETADO (Fase 5C.1)                                         |
| Agenda scheduling operations      | COMPLETADO (Fase 5C.2A)                                        |
| Agenda workflow operations        | COMPLETADO (Fase 5C.2B)                                        |
| Agenda availability UI            | COMPLETADO (Fase 5C.2B)                                        |
| Agenda hardening                  | COMPLETADO (Fase 5D)                                           |
| Agenda                            | COMPLETADO (Fases 5A–5D)                                       |
| Google Calendar                   | POSTERGADO                                                     |
| Notifications                     | POSTERGADO                                                     |
| Public booking                    | POSTERGADO                                                     |
| Clínica — análisis Fase 6A        | COMPLETADO                                                     |
| Clínica — design gate 6A.1        | COMPLETADO                                                     |
| Clínica — fundación 6B.1          | COMPLETADO (schema, migración, seed, permisos y tests)         |
| Clínica — núcleo API 6B.2         | COMPLETADO (API, transacciones, CAS, auditoría y tests)        |
| Clínica — frontend read-only 6C.1 | COMPLETADO (rutas, historia y detalle en modo lectura)         |
| Clínica — operaciones UI 6C.2A    | COMPLETADO (borradores, vitales y perfil profesional)          |
| Clínica — finalize/void UI 6C.2B  | COMPLETADO (finalización, evoluciones y anulación)             |
| Clínica — hardening 6C.3          | COMPLETADO (invariantes, concurrencia, tenant, UX y auditoría) |
| Clinical Core                     | COMPLETADO                                                     |
| Prescriptions — análisis 6D.1     | COMPLETADO (referencia legacy, propuesta y decisiones)         |
| Prescriptions — backend 6D.2      | PENDIENTE                                                      |
| Prescriptions — frontend 6D.3     | PENDIENTE                                                      |
| Inventario                        | Pendiente                                                      |
| Facturación                       | Pendiente                                                      |
| SaaS                              | Pendiente                                                      |
| Multi-tenancy SaaS completo       | EN PROGRESO                                                    |

La base visual de Fase 2 no significa que una funcionalidad de negocio esté migrada.

Fase 6A — análisis y arquitectura clínica:

- Se inspeccionó el checkout legacy Lativet en el commit
  `05fea495cb13208b27bf470b3570987fd501a81e` (`05fea49`) únicamente en modo
  lectura, sin ejecutarlo, sin conectarse a su base y sin modificarlo.
- Se documentaron el mapa de módulos, entidades observadas, ciclo de vida,
  seguimiento, peso/signos vitales, documentos, consentimientos, firmas,
  remisiones y side effects en
  `docs/migration/clinical-reference.md`.
- Se documentaron la propuesta de núcleo/satélites, aislamiento tenant,
  permisos, PII, decisiones abiertas y alcance exacto de una futura Fase 6B en
  `docs/architecture/clinical-domain-proposal.md` y
  `docs/architecture/clinical-decisions.md`.
- Se documentaron los límites transaccionales, proyecciones de Patient,
  idempotencia, outbox, retención y política de no hard-delete en
  `docs/architecture/clinical-transactions.md`.
- En ese checkpoint no se crearon modelos Prisma, migraciones, endpoints,
  componentes React ni tablas clínicas; la implementación posterior queda
  registrada bajo Fase 6B.1.

Checkpoint 6A.1 — Clinical Design Gate completado documentalmente:

- `ClinicalRecord` queda recomendado como único expediente longitudinal por
  `Organization + Patient`, creado lazy; no tiene lifecycle clínico.
- `ClinicalEncounter` queda con `DRAFT`, `FINALIZED` y `VOIDED`, finalización
  irreversible y optimistic concurrency por `version`.
- Evoluciones son append-only; se conserva el caso legacy de notas directas al
  Record y se permite vínculo opcional a Encounter finalizado.
- Appointment es nullable y único por organización; ClinicLocation es requerido
  para encuentros presenciales; Owner y profesional se congelan mediante
  relaciones/snapshots derivados por backend.
- Se seleccionó separar `organizationRole` de capability/perfil clínico. El
  perfil profesional de Membership quedó implementado en 6B.1 como relación
  1:0..1 con `displayName` y `licenseNumber` nullable; no contiene especialidad
  ni catálogos prematuros.
- El contrato conceptual, APIs y plan de pruebas se mantienen en
  `docs/architecture/clinical-core-6b.md`; en el checkpoint los endpoints
  seguían pendientes y fueron implementados en Fase 6B.2.

Fase 6B.1 — fundación del núcleo clínico completada:

- Las migraciones `20260921130259_add_clinical_core_foundation` y sus ajustes
  versionados de vocabulario/índices añaden `ClinicalRole`,
  `MembershipProfessionalProfile`, `ClinicalRecord`, `ClinicalEncounter`,
  `ClinicalEvolution`, `VitalMeasurement` y `ClinicalAuditEvent`, con FKs
  tenant-aware, índices de consulta, checks de lifecycle y numeric checks.
- Los permisos clínicos se resuelven desde `Membership.clinicalRole` y se
  combinan con la matriz organizacional. `PLATFORM_ADMIN` no obtiene acceso
  clínico automático.
- El seed es ficticio e idempotente: Norte tiene un perfil Practitioner, un
  draft, un encounter finalizado, vitales, evolución y auditoría; Sur mantiene
  una contraparte mínima para pruebas de tenant. No se crean dominios clínicos
  satélite.
- La Fase 6B.2 implementó el API tenant-safe del núcleo: Record lazy,
  encounters DRAFT/FINALIZED/VOIDED, CAS, vitals, evoluciones append-only,
  snapshots profesionales, auditoría y proyección de peso. No se implementó
  frontend clínico ni satélites.
- La migración fue aplicada localmente solo a `easyvet_dev` y `easyvet_test`;
  no se modificaron migraciones previas ni bases externas.

Fase 6C.2A — operación clínica en borrador y perfil profesional completada:

- Se añadieron endpoints tenant-safe para leer/actualizar el perfil profesional de la membresía
  activa y listar únicamente Practitioners activos con campos mínimos.
- El frontend incorpora `/perfil/profesional`, creación y edición de encuentros DRAFT, selector de
  sedes/citas/profesionales, CAS con recarga explícita ante stale e ingreso append-only de vitales.
- Practitioner y Clinical Assistant conservan create/updateDraft/vitals según la matriz existente;
  `OWNER` sin `clinicalRole` continúa denegado. Pacientes archivados no pueden iniciar drafts.
- Las fechas se convierten en `Organization.timezone`, el cambio de tenant limpia el formulario y
  no se implementaron finalize, void, evoluciones ni satélites.
- QA manual en `easyvet_dev` creó un draft ficticio y una medición de 12.8 kg; el registro quedó en
  `DRAFT` y el peso actual del paciente permaneció sin cambios. No se modificó seed ni se creó una
  migración nueva.
- `easyvet_test` mantiene sus datos de pruebas; no se escribieron bases compartidas o productivas.

Fase 6C.2B — finalización clínica, evoluciones y anulación completada:

- El backend exige que solo el Practitioner responsable de la consulta pueda finalizarla; el
  perfil profesional se valida al momento de la acción y el snapshot de nombre/licencia queda
  congelado. Practitioner distintos y Clinical Assistant reciben un error controlado.
- El frontend incorpora revisión previa, CAS con `expectedVersion`, recarga explícita ante stale,
  bloqueo de edición/vitales tras FINALIZED y lectura histórica del snapshot.
- Las evoluciones son append-only, con narrativa obligatoria y autor derivado del backend; pueden
  vincularse a un encuentro FINALIZED o al ClinicalRecord existente. No se implementó edición ni
  borrado.
- Anular exige motivo, conserva historia y vitales con advertencia, recalcula el peso proyectado y
  bloquea nuevas evoluciones. No se creó migración ni se modificó Prisma en esta fase.
- QA manual real ejecutado únicamente sobre `easyvet_dev`: se finalizó, evolucionó y anuló una
  consulta ficticia de Norte/Luna; se verificaron snapshots, motivo, auditoría, estados y layout
  móvil de 390 px. `easyvet_test` se reservó para pruebas automatizadas.
- La suite agregó regresiones para autoría del responsable, narrativa vacía, snapshots, acciones
  por permiso y operaciones de frontend. En ese checkpoint, Fase 6C.3 y los satélites permanecían
  pendientes.

Fase 6C.3 — hardening y cierre del Clinical Core completada:

- La revisión final contra Lativet está en `docs/migration/clinical-core-final-review.md`.
  La matriz clasifica cardinalidad de Record, lifecycle, evoluciones, vitales, identidad,
  proyección de peso, hard delete, auditoría, Appointment, Owner y concurrencia.
- Se corrigió el único bug funcional encontrado: un Vital podía crearse para un Patient archivado
  si el Encounter seguía en DRAFT. Ahora toda nueva actividad clínica exige Patient `ACTIVE`.
- Se verificaron carreras de creación lazy de Record, CAS de draft/finalize/void, lifecycle terminal,
  FKs compuestas, errores públicos, paginación, límites de texto y ausencia de N+1 obvio.
- No se creó migración ni se modificó Prisma. Los satélites y sus decisiones de producto siguen
  POSTERGADOS.

La Fase 2 queda detenida después del AppShell, navegación, dashboard demo y
componentes UI compartidos. Fase 3A añadió el modelo multi-tenant fundamental y
Fase 3B añadió sesiones y autenticación real; Fase 3C añadió la fundación de
autorización y aislamiento. Los módulos veterinarios siguen fuera de alcance.

Checkpoint 2.5 verificado localmente:

- Docker Engine 29.8.0 y Docker Compose v5.5.1 disponibles.
- PostgreSQL 16.15 mediante `postgres:16-alpine` en Docker Compose.
- Puerto local: `localhost:5432`.
- Conexión Prisma mediante `DATABASE_URL` del `.env` local, usando `prisma db execute` con `SELECT 1` y un `$queryRawUnsafe('SELECT 1')` técnico.
- El esquema Prisma sigue sin modelos de dominio y la base pública contiene cero tablas.
- NestJS respondió `HTTP 200` en `GET /api/v1/health`.

Checkpoint 2.6 completado:

- NestJS 11 fue actualizado coordinadamente a NestJS 12.0.3.
- Prisma se mantuvo en la misma major y su CLI quedó clasificada como
  `devDependency`; `@prisma/client` continúa como dependencia de runtime.
- Las vulnerabilidades transitivas de `multer` desaparecieron tras la
  actualización. El detalle del audit y las vulnerabilidades de tooling
  pendientes está en `docs/architecture/DEPENDENCY_SECURITY.md`.
- No se añadieron modelos, tablas ni módulos de dominio; Fase 3 no iniciada.

Fase 3A completada:

- `Organization`, `ClinicLocation`, `User` y `Membership` creados con enums,
  constraints, índices y relaciones tenant-aware.
- Migración Prisma inicial del dominio aplicada únicamente al PostgreSQL local.
- Seed ficticio e idempotente verificado para dos organizaciones, dos sedes,
  tres usuarios y cuatro memberships.
- Autorización completa y entidades clínicas permanecen pendientes en este
  punto histórico de Fase 3A.

Fase 3B completada:

- `Session` y la migración `20260920044322_add_session_auth` fueron añadidos sin
  modificar la migración de Fase 3A.
- Login, restauración de sesión, selección explícita de organización y logout
  usan cookie HttpOnly con token aleatorio cuyo hash SHA-256 es el único valor en
  PostgreSQL.
- CSRF de navegador, contratos Zod compartidos y cliente API con credenciales
  explícitas quedaron cubiertos por pruebas de integración y frontend.
- Rate limiting de login, MFA, recuperación de contraseña, invitaciones y
  permisos siguen pendientes para fases posteriores.

Fase 3C completada:

- Autenticación global deny-by-default con `@Public()` únicamente para health y
  login.
- `TenantContext`, `TenantContextGuard`, `@CurrentTenant()`, permisos tipados,
  matriz role-permission, `@RequirePermissions()` y `PermissionGuard`.
- Separación `PlatformAdminGuard`/`/platform/context` sin bypass tenant.
- APIs tenant-safe de organization actual, locations y memberships con política
  cross-tenant `404 RESOURCE_NOT_FOUND`.
- Permisos efectivos incluidos en `/auth/me` y recalculados después de cambiar
  de organization; frontend `useCan`/`Can` solo para UX.
- No se crearon tablas de permisos, RLS, audit log, impersonation ni entidades
  veterinarias.

Fase 4A completada:

- Se documentó la referencia legacy de propietarios y pacientes, incluyendo
  reglas confirmadas, cascadas destructivas y puntos `NEEDS REVIEW`.
- Se añadieron `Owner` y `Patient` tenant-scoped con estados `ACTIVE`/`ARCHIVED`,
  índices de consulta y FK compuesta para impedir asociaciones cross-tenant.
- La migración `20260920053505_add_owner_patient_domain` se aplicó localmente a
  `veterinary_saas` y se preparó con `prisma migrate deploy` en `easyvet_test`.
- Se añadieron APIs paginadas, buscables y autorizadas; archive reemplaza el
  borrado físico y no cascada a dependencias futuras.
- El seed idempotente contiene 4 Owners y 6 Patients repartidos entre Norte y
  Sur. No se construyó frontend funcional ni se inició Fase 4B.

Fase 4B completada:

- Owners y Patients tienen rutas funcionales de listado, búsqueda, filtros,
  paginación, detalle, creación, edición y archive lógico.
- El frontend usa clientes API tipados, contratos Zod, permisos UX y estados
  tenant-scoped que se limpian al cambiar de organización.
- Se añadieron pruebas frontend de loading, empty, errores, conflictos,
  permisos, formularios, archive, 404 cross-tenant y tenant switch.
- La documentación de decisiones está en
  `docs/migration/owners-patients-ui.md`.
- No se inició ningún módulo clínico, agenda, financiero o grooming.

Fase 4C completada:

- Se comparó el comportamiento de negocio legacy con Easyvet y se clasificaron
  los comportamientos como preservados, rediseñados intencionalmente,
  postergados o `NEEDS REVIEW`.
- Se reforzaron fechas civiles, peso, nombres activos por Owner, payloads
  estrictos, operaciones tenant-scoped, archive rules y la carrera archive/create.
- La migración `20260920120000_harden_owner_patient_invariants` agrega checks de
  lifecycle/peso y unicidad de paciente activo sin reescribir migraciones
  aplicadas.
- La revisión final está en `docs/migration/owners-patients-final-review.md` y
  el patrón futuro en `docs/architecture/module-pattern.md`.
- Agenda y Fase 5 permanecen pendientes; no se inició ningún módulo nuevo.

Checkpoint 4D completado:

- Se eliminó la unicidad de nombres de Patient mediante la nueva migración
  `20260920140000_relax_patient_name_and_weight_invariants`; `Patient.id` es la
  identidad y `nameNormalized` queda únicamente para búsqueda/ordenamiento.
- Se retiró el límite veterinario `currentWeightKg <= 1000` y el snapshot pasó a
  `NUMERIC(20,6)` con la única invariante de ser positivo cuando existe.
- Se verificaron dos Patients con el mismo nombre bajo el mismo Owner y en
  organizaciones distintas; PII para GROOMER/CASHIER sigue `NEEDS REVIEW`.
- La migración se aplicó a las bases locales `easyvet_dev` y `easyvet_test`;
  también se sincronizó la base local previa `veterinary_saas` usada por el
  `.env` histórico. No se modificaron bases externas.

Fase 5A — análisis y diseño de Agenda completada:

- Se documentó la referencia legacy de Agenda, Reservas, disponibilidad,
  Google Calendar, controles, seguimientos y dependencias conocidas.
- Checkpoint 5A.1 completado: se inspeccionó directamente el repositorio
  Lativet en el commit `05fea495cb13208b27bf470b3570987fd501a81e`, mediante el
  checkout read-only `C:\Users\danil\Downloads\Lativet-reference`, fuera de
  Easyvet y en `detached HEAD`.
- Se verificaron los paths reales de `Backend/AGENDA` y `Frontend/AGENDA`, el
  DDL y campos de `appointments`, los nueve estados, reservas, disponibilidad,
  conflictos, controles, Google Calendar, Peluquería y frontend.
- Los cuatro documentos de Agenda separan ahora **VERIFIED LEGACY BEHAVIOR**,
  **NEW EASYVET DESIGN DECISION**, **PRODUCT DECISION REQUIRED** y
  **POSTPONED**, y corrigen las afirmaciones preliminares que no resistían la
  lectura del código.
- En ese checkpoint no se modificaron `prisma/schema.prisma`, migraciones,
  endpoints, UI, Owners/Patients ni permisos; Fase 5B no se había iniciado aún.
- PostgreSQL/Docker conserva el estado `VERIFICADO LOCALMENTE` registrado en el
  checkpoint 4D; esta fase no simula verificación de producción ni de una base
  compartida.

Fase 5B — backend de Agenda completada:

- Se añadió la migración `20260920150000_add_agenda_backend` sin modificar
  migraciones previas. Se aplicó únicamente a `easyvet_dev` y `easyvet_test`;
  la base histórica `veterinary_saas` no se utilizó.
- Se crearon `Appointment` y `AvailabilityRule` con FK compuestas tenant-safe,
  `TIMESTAMPTZ(3)`, validación de horas civiles y enum de estados explícitos.
- `btree_gist` y exclusion constraints PostgreSQL protegen solapamientos
  concurrentes por Patient y Membership usando `[start, end)`.
- Se implementaron endpoints de listado/detalle/creación, edición limitada,
  reprogramación, cancelación, acciones de estado, confirmación, reglas de
  disponibilidad y slots.
- Se añadieron contratos Zod, permisos tipados y matriz por rol. No se creó
  tabla de permisos ni Professional.
- El seed idempotente contiene 3 AvailabilityRules y 6 Appointments ficticios.
- Archivar Patient se bloquea cuando existen citas futuras bloqueantes.
- La suite DB pasó 65 pruebas, incluida concurrencia real; Fase 5C no inició.

Fase 5C.1 — frontend de Agenda de solo lectura completada:

- `/agenda` muestra calendario mensual, semanal, diario y de lista conectado a
  los endpoints reales de Agenda, con filtros tenant-safe y detalle de cita.
- La URL conserva `view` y fecha civil; la zona horaria proviene de
  `Organization.timezone` y no del navegador.
- Se añadieron cancelación de peticiones, limpieza al cambiar de tenant,
  estados de carga/error/vacío, responsive y accesibilidad básica.
- Las operaciones de programación se cerraron en Fase 5C.2A; workflow y
  hardening permanecen pendientes.

Fase 5C.2A — operaciones de programación completada:

- `/agenda/nueva` crea citas usando el contrato aprobado de Fase 5B; el Owner
  se deriva del Patient activo y no se aceptan campos de tenant, lifecycle o
  auditoría desde el formulario.
- Editar información y reprogramar tienen rutas separadas y permisos
  `appointments.update`; editar no cambia tiempo y reprogramar no usa PATCH.
- El detalle ofrece cancelación confirmada con `appointments.cancel`; las citas
  canceladas permanecen en Agenda con estado `CANCELLED`.
- La UI consulta `available-slots`, soporta `RULES` y `UNRESTRICTED`, convierte
  fechas civiles con `Organization.timezone`, traduce conflictos `409` y
  cancela requests al cambiar de tenant.
- No se implementaron check-in, start, complete, no-show, confirmaciones,
  administración de AvailabilityRule ni drag-and-drop. Fase 5C.2B y Fase 5D
  permanecen pendientes.
- Validaciones de cierre: 100 pruebas frontend, 65 pruebas DB, `test:all`,
  format, lint, typecheck, build, generación/validación Prisma y audit
  ejecutados sin upgrades automáticos.

Fase 5C.2B — workflow operativo y disponibilidad completada:

- El frontend usa las transiciones dedicadas de Agenda para check-in, inicio,
  completado y no-show, con guards de estado/permisos, confirmación explícita
  para no-show y refresh ante conflictos `409`.
- El detalle muestra confirmaciones de Owner y clínica con timestamp en la zona
  horaria de la organización. La confirmación del Owner permanece como lectura;
  no se habilita una acción manual de backoffice.
- Day/List incorpora resumen operativo y refresh periódico de 45 segundos sin
  duplicar consultas. No hay optimistic updates.
- `/agenda/disponibilidad` lista, crea, edita, activa y desactiva reglas
  recurrentes por sede, con horas civiles, días mapeados, intervalos 15–240,
  Membership opcional y explicación de `UNRESTRICTED`. No se añadió
  `ScheduleBlock` ni otra entidad.
- No se modificó Prisma ni se crearon migraciones nuevas. La seguridad de
  tenant sigue delegada al backend y los deep links de otra organización no
  exponen datos.
- Al cerrar este checkpoint, Fase 5D todavía no se había iniciado; su cierre
  posterior queda documentado en la sección siguiente.

Fase 5D — hardening y cierre definitivo de Agenda completada:

- Se contrastó Agenda con `docs/migration/agenda-reference.md` y el checkout
  read-only de Lativet en el commit `05fea495cb13208b27bf470b3570987fd501a81e`.
  La matriz final está en `docs/migration/agenda-final-review.md`.
- La máquina de estados, los estados bloqueantes/terminales, las confirmaciones
  como timestamps UTC y la semántica `CANCELLED`/`NO_SHOW` quedaron revisados.
  Edición, cancelación, confirmación y workflow usan compare-and-set para
  rechazar acciones obsoletas con `409`.
- Se rechazaron reglas de disponibilidad activas solapadas dentro del mismo
  alcance y se conservaron los intervalos half-open `[start, end)`; se
  añadieron regresiones de adyacencia, precedencia, `UNRESTRICTED`, carreras y
  DST de salto/repetición.
- Se revisaron FKs compuestas, límites de lista de 90 días, aislamiento de
  tenant, matriz de permisos, polling Day/List, deep links, navegación de URL,
  responsive 390 px y el warning de bundle de FullCalendar.
- No se crearon módulos clínicos, Google Calendar, recordatorios, booking
  público, `ScheduleBlock`, `AppointmentType`, migraciones de limpieza ni
  placeholders. Las decisiones pendientes y límites están documentados.

Checkpoint 5C.1.1 cerrado:

- El `.env` local y `.env.example` usan `easyvet_dev` para desarrollo; las
  pruebas DB mantienen `easyvet_test`. `veterinary_saas` quedó fuera del flujo
  normal, de migraciones y de QA, sin modificaciones en este checkpoint.
- El flujo documentado `npm run dev` arrancó sin sobrescribir `DATABASE_URL`;
  `GET /api/v1/health` respondió `200` y Agenda cargó sin error de tabla
  `Appointment` ausente.
- QA móvil en viewport emulado de 390 px cubrió navegación, filtros,
  Day/List/Month, detalle, cierre, scroll y ausencia de overflow horizontal.
- QA multi-tenant `multi@demo.local` cubrió Norte → Sur → Norte: el detalle se
  cerró, los filtros y eventos se revalidaron por tenant, Sur no mostró citas
  Norte y la recuperación a Norte cargó sus cuatro citas. El deep link de una
  cita Norte bajo Sur mostró `Recurso no encontrado`.
- La cita seed `2030-01-08T14:00:00.000Z` se verificó visualmente como
  09:00 en `America/Bogota`. El build conserva el warning del chunk web de
  aproximadamente 758.85 kB (223.94 kB gzip); code-splitting queda recomendado
  para un checkpoint posterior.
- En ese checkpoint todavía no se habían implementado mutaciones de Agenda;
  las operaciones de programación se añadieron después en Fase 5C.2A.

Para detener el entorno local:

```bash
docker compose down
```

No se documentan contraseñas locales reales.

Fase 6D.1 — análisis y diseño de Prescriptions completada:

- Se inspeccionó directamente el checkout legacy `Lativet-reference` en el
  commit `05fea495cb13208b27bf470b3570987fd501a81e` (`05fea49`), incluyendo
  Fórmulas médicas, Consultas, Historia, Documentos, exportación/PDF, permisos,
  Inventario, Ventas y pruebas.
- Se verificó que la fórmula legacy es una especialización de
  `clinical_consultations` (`consultation_type = "Formula"`) con medicamentos
  serializados en `document_reference`; no existe una entidad de prescripción
  independiente ni tabla de items.
- Se documentaron el comportamiento observado y la matriz de campos en
  `docs/migration/prescriptions-reference.md`.
- Se documentaron la propuesta tenant-safe de `Prescription`/
  `PrescriptionItem`, lifecycle, CAS, auditoría, permisos, APIs y límites con
  Encounter, PDF, firma, Inventario y Ventas en
  `docs/architecture/prescriptions-proposal.md`.
- Se registraron las recomendaciones y decisiones de producto pendientes en
  `docs/architecture/prescriptions-decisions.md`.
- No se modificaron Prisma, migraciones, backend, frontend, permisos ni tests.
  Prescriptions backend (6D.2) y frontend (6D.3) permanecen pendientes.
