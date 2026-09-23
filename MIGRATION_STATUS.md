# Estado final de migración — V1 (2026-09-23)

Este es el estado vigente del producto. La tabla y las notas de fases históricas que siguen más abajo documentan snapshots anteriores; no representan funcionalidades pendientes de V1.

| Área                                                                     | Estado actual                                                                             |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| SaaS, organizaciones, sedes y aislamiento multi-tenant                   | COMPLETADO                                                                                |
| Autenticación, sesiones, membresías, autorización y cambio de contraseña | COMPLETADO                                                                                |
| Owners / Patients                                                        | COMPLETADO                                                                                |
| Agenda y disponibilidad                                                  | COMPLETADO                                                                                |
| Clinical Core                                                            | COMPLETADO                                                                                |
| Prescriptions y Preventive Care                                          | COMPLETADO                                                                                |
| Procedures / Surgery / Anesthesia / Hospitalization / Diagnostics        | COMPLETADO                                                                                |
| Documents / Consents / Signatures                                        | COMPLETADO                                                                                |
| Follow-ups / Reminders internos                                          | COMPLETADO                                                                                |
| Grooming                                                                 | COMPLETADO                                                                                |
| Inventory                                                                | COMPLETADO                                                                                |
| Sales / Billing interno / Cash                                           | COMPLETADO                                                                                |
| Users / Settings / Reports                                               | COMPLETADO                                                                                |
| PostgreSQL local                                                         | VERIFICADO LOCALMENTE; `easyvet_dev` y `easyvet_test` usan las 27 migraciones versionadas |
| Easyvet V1 closure                                                       | COMPLETADO; consulte `docs/qa/v1-closure.md`                                              |
| Servicios externos y capacidades excluidos de V1                         | NO INCLUIDOS; consulte `docs/release/v1-known-limitations.md`                             |

Google Calendar, reservas públicas, entrega de notificaciones externas y otros elementos explícitamente diferidos son límites de alcance, no módulos V1 pendientes.

## Snapshot histórico inicial (no usar como estado actual)

La tabla original de fases se conserva como registro histórico para trazabilidad. Los estados como “EN PROGRESO” o “Pendiente” reflejaban el momento en que se escribió y fueron sustituidos por la matriz vigente anterior.

<!-- Historical phase matrix begins here. -->

### Estado de migración en checkpoints anteriores

| Área                                    | Estado                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Auditoría legacy                        | Completada                                                                    |
| Monorepo                                | Completado                                                                    |
| React/Vite                              | App shell y base visual de Fase 2 completados                                 |
| NestJS                                  | Infraestructura; Nest 12.0.3 verificado                                       |
| PostgreSQL                              | VERIFICADO LOCALMENTE                                                         |
| Prisma                                  | Modelos Fases 3A/3B/4A/5B y migraciones aplicados localmente                  |
| Core tenant model                       | COMPLETADO (Fase 3A)                                                          |
| Multi-tenancy                           | Fundación de aislamiento completada (Fase 3C)                                 |
| Autenticación                           | COMPLETADA (Fase 3B)                                                          |
| Autorización                            | COMPLETADA (Fase 3C)                                                          |
| UI Lativet                              | Referencia analizada; adaptación React completada                             |
| Owners backend                          | COMPLETADO (Fase 4A)                                                          |
| Patients backend                        | COMPLETADO (Fase 4A)                                                          |
| Owners frontend                         | COMPLETADO (Fase 4B)                                                          |
| Patients frontend                       | COMPLETADO (Fase 4B)                                                          |
| Owners/Patients final review            | COMPLETADO (Fase 4C)                                                          |
| Agenda analysis/design                  | COMPLETADO (Fase 5A)                                                          |
| Agenda backend                          | COMPLETADO (Fase 5B)                                                          |
| Agenda frontend read-only               | COMPLETADO (Fase 5C.1)                                                        |
| Agenda scheduling operations            | COMPLETADO (Fase 5C.2A)                                                       |
| Agenda workflow operations              | COMPLETADO (Fase 5C.2B)                                                       |
| Agenda availability UI                  | COMPLETADO (Fase 5C.2B)                                                       |
| Agenda hardening                        | COMPLETADO (Fase 5D)                                                          |
| Agenda                                  | COMPLETADO (Fases 5A–5D)                                                      |
| Google Calendar                         | POSTERGADO                                                                    |
| Notifications                           | POSTERGADO                                                                    |
| Public booking                          | POSTERGADO                                                                    |
| Clínica — análisis Fase 6A              | COMPLETADO                                                                    |
| Clínica — design gate 6A.1              | COMPLETADO                                                                    |
| Clínica — fundación 6B.1                | COMPLETADO (schema, migración, seed, permisos y tests)                        |
| Clínica — núcleo API 6B.2               | COMPLETADO (API, transacciones, CAS, auditoría y tests)                       |
| Clínica — frontend read-only 6C.1       | COMPLETADO (rutas, historia y detalle en modo lectura)                        |
| Clínica — operaciones UI 6C.2A          | COMPLETADO (borradores, vitales y perfil profesional)                         |
| Clínica — finalize/void UI 6C.2B        | COMPLETADO (finalización, evoluciones y anulación)                            |
| Clínica — hardening 6C.3                | COMPLETADO (invariantes, concurrencia, tenant, UX y auditoría)                |
| Clinical Core                           | COMPLETADO                                                                    |
| Prescriptions — análisis 6D.1           | COMPLETADO (referencia legacy, propuesta y decisiones)                        |
| Prescriptions — backend 6D.2            | COMPLETADO                                                                    |
| Prescriptions — frontend 6D.3A          | COMPLETADO (lectura, snapshots y aislamiento)                                 |
| Prescriptions — frontend 6D.3B          | COMPLETADO (drafts, items, CAS, finalize y void)                              |
| Prescriptions — hardening 6D.4          | COMPLETADO (locks, lifecycle, invariantes, snapshots, tenant, auditoría y UX) |
| Preventive care — análisis 6E.1         | COMPLETADO (referencia legacy, propuesta y decisiones)                        |
| Preventive care — backend 6E.2          | COMPLETADO (schema, migración, API, lifecycle, CAS, auditoría y tests)        |
| Vaccinations backend                    | COMPLETADO (Fase 6E.2)                                                        |
| Dewormings backend                      | COMPLETADO (Fase 6E.2)                                                        |
| Preventive Care frontend read-only      | COMPLETADO (Fase 6E.3A)                                                       |
| Preventive Care operations              | COMPLETADO (Fase 6E.3B: create/edit/finalize/void, CAS y UX tenant-safe)      |
| Preventive Care hardening               | COMPLETADO (Fase 6E.4: invariantes, concurrencia, PII, UX y auditoría)        |
| Preventive Care                         | COMPLETADO (Fases 6E.1–6E.4)                                                  |
| Procedures/Surgery analysis 6F.1        | COMPLETADO (análisis y Design Gate 6F.1.1)                                    |
| Procedures/Surgery backend 6F.2A        | COMPLETADO (schema, migración, API, permisos, seed y tests)                   |
| Anesthesia backend 6F.2B                | COMPLETADO (schema, migración, API, permisos, seed y tests)                   |
| Procedures/Surgery frontend             | COMPLETADO (Fase 6F.3)                                                        |
| Anesthesia frontend/monitoring          | COMPLETADO (Fase 6F.3)                                                        |
| Procedures/Surgery/Anesthesia hardening | COMPLETADO (Fase 6F.3)                                                        |
| Fase 6F                                 | COMPLETADA                                                                    |
| Documents/Consents/Signatures           | COMPLETADO (Fase 6I)                                                          |
| FollowUps / recordatorios internos      | EN PROGRESO (Fase 6J; backend, frontend y hardening en verificación)          |
| Inventory integration                   | COMPLETADO (consumo y reversión transaccionales, Fase 9)                      |
| External preventive records             | POSTERGADO                                                                    |
| Inventario                              | COMPLETADO (Fase 8; integración comercial Fase 9)                             |
| Sales / Billing / Cash                  | COMPLETADO (Fase 9)                                                           |
| Facturación                             | COMPLETADO (factura interna; fiscal/electrónica fuera de alcance)             |
| Caja                                    | COMPLETADO (Fase 9)                                                           |
| SaaS                                    | Pendiente                                                                     |
| Multi-tenancy SaaS completo             | EN PROGRESO                                                                   |

## Registro histórico de fases

Las notas siguientes son reportes históricos de checkpoints y conservan el alcance y estado de su fecha; no modifican la matriz vigente de V1.

La base visual de Fase 2 no significaba, en aquel checkpoint, que una funcionalidad de negocio estuviera migrada.

Fase 6E.2 — backend de Preventive Care completada:

- Se añadieron `Vaccination` y `Deworming` como tablas independientes, con
  Encounter obligatorio, FKs compuestas tenant-safe, índices, checks de
  lifecycle/fechas/snapshots y migración `20260921212106_add_preventive_care_backend`.
- Se implementaron los seis endpoints por dominio, contratos Zod, DTOs estrictos,
  permisos separados, operaciones DRAFT/FINALIZED/VOIDED, CAS y locks ordenados.
- Finalizar calcula snapshots server-side (incluido Owner histórico del
  Encounter), registra auditoría genérica y no crea recordatorios, citas,
  inventario, documentos ni proyecciones en Patient.
- El seed ficticio e idempotente incluye dos Vaccinations y tres Dewormings entre
  Norte y Sur. La migración fue aplicada localmente solo a `easyvet_dev` y
  `easyvet_test`; no se tocaron bases compartidas o productivas.
- La cobertura automatizada incluye tenant isolation, permisos, validaciones de
  fechas, snapshots históricos, CAS/lifecycle y carreras de finalización.

Fase 6E.3A — frontend read-only de Preventive Care completada:

- Se añadieron las rutas semánticas de lectura para vacunaciones,
  desparasitaciones y su vista combinada dentro de la historia clínica.
- Los permisos `vaccinations.read` y `dewormings.read` se resuelven de forma
  independiente en historia, encuentro, listado y detalle; no se habilitan
  operaciones de escritura ni CTAs de negocio.
- Los clientes y hooks están separados por dominio, validan contratos Zod,
  cancelan solicitudes stale y limpian datos al cambiar de tenant, paciente,
  encuentro o página.
- La UI muestra lifecycle, snapshots, encuentros padres anulados, pacientes
  archivados, fechas civiles y timestamps técnicos con la zona horaria de la
  organización, incluyendo deep-link cross-tenant como 404.
- Se documentó la arquitectura en `docs/architecture/preventive-care-frontend.md`
  y la trazabilidad de migración en `docs/migration/preventive-care-ui.md`.
- No se modificó Prisma, no se creó migración y no se alteró el seed. La Fase
  6E.3B queda registrada en la sección siguiente.

Fase 6E.3B — operaciones UI de Preventive Care completada:

- Se añadieron rutas contextuales para crear Vaccination/Deworming desde un
  Encounter y rutas de edición DRAFT; las listas permanecen read-only.
- Finalize y Void viven únicamente en detalle, con permisos independientes,
  validación de campos mínimos, revisión, CAS, stale UX, perfil profesional,
  snapshots del backend y motivo obligatorio de anulación.
- Las fechas civiles se mantienen como `YYYY-MM-DD`; `nextDueOn` se valida en
  cliente y `expiryOn` anterior es warning no bloqueante. `administeredBy` se
  elige explícitamente desde miembros clínicos activos del tenant.
- Se agregó `GET /clinical/members` sin cambiar la semántica del lookup de
  practitioners. No se modificó Prisma, no se creó migración y no se alteró el
  seed. Reminders, inventory y certificates siguen fuera de alcance.
- Preventive Care hardening quedó **COMPLETADO (Fase 6E.4)**; no se inicia el
  siguiente módulo en este checkpoint.

Fase 6E.4 — hardening y cierre de Preventive Care completada:

- Se verificaron constraints SQL, lifecycle terminal, CAS, fechas civiles,
  `nextDueOn`, warning no bloqueante de `expiryOn`, snapshots, Patient
  archivado, Encounter padre, orden de locks y auditoría sin narrativa clínica.
- `administeredBy` quedó restringido explícitamente a miembros clínicos activos;
  el actor de `void` se revalida y bloquea dentro de la transacción. Se redujo
  `GET /clinical/members` al selector mínimo sin matrícula ni correo y se
  corrigieron mensajes preventivos de stale/estado/fechas.
- No se creó migración nueva, no se modificó Prisma, seed, inventario,
  recordatorios, certificados ni documentos. La matriz legacy está en
  `docs/migration/preventive-care-final-review.md`.
- QA manual previo y regresiones automatizadas se ejecutaron únicamente con
  datos ficticios en `easyvet_dev`; `easyvet_test` quedó reservado para la
  suite. Docker/PostgreSQL permanecen verificados localmente, no en producción.

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

Fase 6D.2 — backend de Prescriptions completada:

- Se añadió la migración versionada
  `20260921150000_add_prescriptions_backend`, aplicada únicamente a
  `easyvet_dev` y `easyvet_test`; no se modificaron migraciones anteriores ni
  se utilizó `veterinary_saas`.
- Se implementaron `Prescription`/`PrescriptionItem`, contratos estrictos,
  endpoints tenant-safe, lifecycle `DRAFT → FINALIZED → VOIDED`, CAS,
  reemplazo atómico de items y snapshots de profesional, Patient, Owner y
  diagnóstico.
- Se ampliaron permisos clínicos y auditoría. Practitioner tiene todas las
  operaciones; Clinical Assistant solo lectura/creación/edición de drafts.
  No existe delete físico ni endpoint de items.
- El seed idempotente contiene tres recetas ficticias y tres items. Las pruebas
  cubren aislamiento, roles, snapshots, invariantes, archive, items y carreras
  reales de update/finalize/void.
- El QA manual se ejecuta únicamente sobre `easyvet_dev`. Docker/PostgreSQL
  debe conservar el estado verificado localmente; no representa una base
  compartida o productiva.
- No se inició la Fase 6D.3 (frontend). PDF, Documents, Storage, firma,
  catálogo, inventario, ventas, facturación y fármacos controlados permanecen
  postergados.

Fase 6D.3A — frontend read-only de Prescriptions completada:

- Se añadieron las rutas lazy de listado y detalle bajo
  `/pacientes/:patientId/historia/prescripciones` y su integración filtrada en
  el detalle de Encounter.
- La UI usa exclusivamente `prescriptions.read`, `apiClient`, contratos Zod y
  hooks tenant-aware con abort de requests. Cambiar de organización limpia
  lista, detalle y estado asociado; un deep link cross-tenant se presenta como
  recurso no encontrado.
- Se muestran lifecycle, timestamps en `Organization.timezone`, cantidad y
  orden de items, snapshots históricos, diagnóstico y avisos independientes
  del Encounter padre. Patient archivado conserva lectura.
- No hay botones ni requests de crear, editar, finalizar, anular, PDF,
  impresión, firma, email, inventario, ventas, facturación o catálogo.
- Se añadieron 40 pruebas read-only y se documentaron routing, permisos,
  snapshots, aislamiento, responsive y límites en
  `docs/architecture/prescriptions-frontend.md` y
  `docs/migration/prescriptions-ui.md`.

Fase 6D.3B — operaciones frontend de Prescriptions completada:

- Se añadió creación contextual desde Encounter en
  `/pacientes/:patientId/historia/encuentros/:encounterId/prescripciones/nueva`
  y edición de drafts desde el detalle. No existe creación global ni selector
  duplicado de Patient/Encounter.
- El editor permite drafts sin items, texto libre, nombre obligatorio,
  agregar/quitar y ordenar con controles accesibles. Cada PATCH reemplaza el
  conjunto completo con posiciones `0..N-1` y `expectedVersion`; stale conserva
  cambios locales hasta recarga explícita.
- Finalizar usa revisión explícita y CAS, exige Practitioner prescriptor,
  perfil configurado, items y Encounter no anulado. Anular solo opera sobre
  `FINALIZED`, exige motivo y conserva evidencia histórica; no hay delete.
- Se reforzó la UX de Clinical Assistant, prescriptor distinto, perfil
  incompleto, Encounter padre anulado, permisos independientes y cambio de
  tenant. Los deep links cross-tenant continúan siendo `404`.
- Se añadieron 26 pruebas específicas de operaciones, además de las 40 de
  lectura existentes. No se modificó Prisma ni se creó una migración nueva.
  PDF, Documents, Storage, firma, email, catálogo, inventario, ventas,
  facturación y fármacos controlados permanecen fuera de alcance.

Fase 6D.4 — hardening y cierre de Prescriptions completada:

- La matriz legacy final está en `docs/migration/prescriptions-final-review.md`.
  Formula como Consultation, items JSON, edición last-write-wins, hard delete,
  profesional, diagnóstico, PDF, Patient/Owner, inventario y múltiples fórmulas
  quedaron clasificados como preservados, rediseñados, postergados o decisión de
  producto requerida.
- Se reforzó la serialización PostgreSQL de create/update/finalize y el void del
  Encounter con orden `ClinicalEncounter → Patient → Prescription`; archive de
  Patient toma lock antes de cambiar el estado. Las carreras parent-void tienen
  resultado determinista y regresiones reales en `easyvet_test`.
- Finalize bloquea Owner y Membership prescriptor antes de leer snapshots; Owner
  update y professional-profile upsert comparten esos locks. La migración
  `20260921201000_harden_prescription_lifecycle_invariants` añade checks SQL de
  versión positiva y coherencia de metadata/snapshots terminales.
- `Prescription` conserva `DRAFT → FINALIZED → VOIDED`, sin PATCH/delete sobre
  estados terminales. Items completos se reemplazan atómicamente, se normalizan
  a `0..N-1` y la migración `20260921200000_harden_prescription_item_invariants`
  protege posición no negativa y nombre no vacío a nivel PostgreSQL.
- Snapshots, autoría del prescriptor, perfil vigente, Patient archivado,
  aislamiento tenant, auditoría append-only, stale UX y warning de Encounter
  anulado fueron revisados y documentados. No se añadieron endpoints de items ni
  funcionalidades documentales.
- La base local PostgreSQL permanece verificada; la nueva migración se aplicó a
  `easyvet_dev` y `easyvet_test`. No se modificaron bases externas ni seed.

Prescriptions (6D.1–6D.4): **COMPLETADO**.
Prescription documents, MedicationCatalog, Inventory, dispensing, billing,
templates, repeat prescriptions y controlled-drug rules: **POSTERGADOS**.

Fase 6E.1 — análisis y diseño de vacunación + desparasitación:

- Se inspeccionó el checkout legacy Lativet en el commit exacto
  `05fea495cb13208b27bf470b3570987fd501a81e` en modo lectura. No se ejecutó,
  no se abrió una base y no se modificó ese checkout. El inventario estructural
  se realizó sobre un archivo temporal creado con `git archive`.
- Se documentó la referencia verificable de archivos, campos, serialización,
  efectos sobre Patient, recordatorios, citas derivadas, permisos, pruebas y
  ambigüedades en `docs/migration/preventive-care-reference.md`.
- Se documentó la propuesta tenant-safe de `Vaccination`/`Deworming`, relación
  obligatoria con `ClinicalEncounter`, multiplicidad `0..N`, fechas civiles,
  lifecycle, snapshots, auditoría, CAS, lock order, APIs futuras, inventario y
  migración en `docs/architecture/preventive-care-proposal.md`.
- Se registraron y cerraron las decisiones estructurales; solo permanecen
  decisiones regulatorias/producto postergadas en
  `docs/architecture/preventive-care-decisions.md`.
- No se modificaron Prisma, migraciones, endpoints, permisos, seed,
  frontend ni backend. No se inició la Fase 6E.2.

Checkpoint 6E.1.1 — Preventive Care Design Gate completado:

- Se corrigió la inconsistencia documental: Vaccination y Deworming requieren
  siempre `ClinicalEncounter`; no existe evento standalone en el MVP.
- Se cerraron los estados permitidos del Encounter padre, la regla de parent
  VOID posterior a un preventivo FINALIZED, la multiplicidad `0..N`, los
  modelos independientes y el enum común `PreventiveRecordStatus`.
- Se eliminó explícitamente `applicationStatus` del MVP; `nextDueOn` queda como
  planificación clínica sin crear Reminder, Appointment, FollowUp ni
  Notification.
- Se fijaron fechas civiles, mínimos de finalización, `doseText`,
  `laboratoryName`, reglas de lote/vencimiento, intervalos/last-date legacy,
  responsable Practitioner, `administeredBy`, snapshots y Patient archived.
- Se cerraron FKs compuestas tenant-safe, índices, CAS/versionado, lock order,
  carreras contra Encounter VOID, auditoría, permisos separados, role matrix,
  APIs, contratos, paginación/orden y mapeo conceptual legacy.
- El contrato literal para la Fase 6E.2 está en
  `docs/architecture/preventive-care-core-6e2.md`; las propuestas y decisiones
  previas fueron actualizadas para no dejar decisiones estructurales abiertas.
- Durante ese checkpoint no se modificaron `prisma/schema.prisma`, migraciones,
  backend, frontend, endpoints, permisos, seeds ni dependencias; la
  implementación posterior queda registrada en la sección 6E.2 anterior.

Fase 6F.1 — análisis y diseño de procedimientos / cirugía completado:

- Se inspeccionó en modo lectura el checkout Lativet fijado en
  `05fea495cb13208b27bf470b3570987fd501a81e`; procedimiento y cirugía legacy
  son consultas genéricas con protocolo JSON, mientras anestesia es otra
  consulta con JSON y monitorización flexible.
- La referencia, propuesta de dominio y matriz de decisiones están en
  `docs/migration/procedures-surgery-reference.md`,
  `docs/architecture/procedures-surgery-proposal.md` y
  `docs/architecture/procedures-surgery-decisions.md`.
- El Design Gate 6F.1.1 quedó COMPLETADO: se cerraron aggregate roots,
  cardinalidades, lifecycle, campos, mínimos de finalización, Consent, equipo,
  anestesia, observaciones, permisos, CAS/locks, auditoría, constraints, APIs,
  contratos, índices y política de legacy.
- Los contratos literales para las fases backend separadas están en
  `docs/architecture/procedures-core-6f2.md` (6F.2A) y
  `docs/architecture/anesthesia-core-6f2.md` (6F.2B). En ese checkpoint ambas
  fases estaban pendientes; el estado actualizado de 6F.2A aparece abajo.
- Este checkpoint fue documental: no se modificaron Prisma, migraciones, seed,
  API, permisos registrados, dependencias, frontend ni backend funcional. No se
  inició Fase 6F.2A ni 6F.2B.

Fase 6F.2A — Procedures/Surgery backend completada:

- `ClinicalProcedure` es el agregado único `PROCEDURE`/`SURGERY` con lifecycle
  `DRAFT → FINALIZED → VOIDED`, CAS, Encounter/Patient obligatorios y tenant
  isolation. `ClinicalSurgeryDetail` es opcional 1:0..1 y solo existe para
  `SURGERY`; cambio de kind y detalle es atómico.
- La migración `20260922020040_procedures_surgery_backend` se aplicó solo a
  `easyvet_dev` y `easyvet_test`. Incluye FKs tenant-aware `RESTRICT`, checks
  de lifecycle, snapshots y versionado, además de índices. Se inspeccionaron
  directamente en PostgreSQL los checks, FKs, índices y unicidad del detalle.
- Se implementaron contratos Zod/DTO, permisos `procedures.*`, endpoints de
  historial/detalle/create/update/finalize/void, snapshots congelados,
  auditoría sin narrativa clínica, seed idempotente ficticio y pruebas reales
  PostgreSQL. El lock order protege contra carreras con void de Encounter y
  archive de Patient.
- QA manual ficticio se ejecutó solo en `easyvet_dev`: Procedure draft/edit/finalize/void,
  Surgery detail y cambio Surgery→Procedure, Surgery con Assistant snapshot, Encounter ya
  FINALIZED, y permisos de Assistant tras seleccionar tenant. Create/update/finalize bloqueados
  cuando una anulación de Encounter gana la carrera; create bloqueado cuando gana el archive de
  Patient. Los 5 registros QA nuevos y sus SurgeryDetail permanecen en la base sin hard delete.
- No-side-effects comprobado en `easyvet_dev`: los conteos de Appointments (12) y Prescriptions
  (10) no cambiaron; no hay tablas de AnesthesiaRecord ni AnesthesiaObservation. No se alteró el
  seed para introducir QA.
- Docker Compose/PostgreSQL local quedó `healthy`; la migración 6F.2A está aplicada únicamente a
  `easyvet_dev` y `easyvet_test`. No se accedió a `veterinary_saas`, otras bases ni servicios
  externos.
- Validaciones finales: `format:check`, `lint`, `typecheck`, `npm test`, `test:db`, `test:all`,
  `build`, `prisma:generate` y `prisma:validate` pasan. `test:db` ejecutó 129 pruebas y `test:all`
  las repitió correctamente. El build conserva avisos no bloqueantes de anotaciones Zod/Rollup y
  del chunk principal mayor a 500 kB.
- `npm audit` informa 5 registros de paquetes afectados: 3 altos (cadena Prisma CLI/config) y 2
  moderados (Vitest/mockers), provenientes de 2 advisories. El árbol `--omit=dev` aún incluye la
  cadena Prisma por el peer opcional de `@prisma/client`; el servidor API no ejecuta el CLI ni
  consume configuración Prisma proporcionada por usuarios. Las correcciones que ofrece npm son
  cambios breaking/downgrade mayor, por lo que no se aplicaron upgrades automáticos.
- `prisma:generate` falló inicialmente con `EPERM` porque el API dev server mantenía abierto el
  motor nativo de Prisma; se detuvo el proceso y la generación y validación pasaron. Fase 6F.2B
  queda registrada abajo; frontend y hardening permanecen **PENDIENTES**.

Fase 6F.2B — Anesthesia backend completada:

- `AnesthesiaRecord` es un agregado independiente con enum propio
  `AnesthesiaRecordStatus`, lifecycle `DRAFT → FINALIZED → VOIDED`, CAS y
  Encounter/Patient obligatorios. `clinicalProcedureId` es opcional y, cuando
  existe, debe pertenecer al mismo Organization, Patient y Encounter.
- `AnesthesiaObservation` queda como serie 0..N sin version propia. Create,
  update y delete de observations solo operan en parent `DRAFT`, exigen
  `expectedVersion` del `AnesthesiaRecord`, incrementan la versión padre una
  sola vez y auditan `UPDATED` sin valores clínicos.
- Las migraciones `20260922043000_anesthesia_backend` y
  `20260922050000_anesthesia_backend_alignment` se aplicaron solo a
  `easyvet_dev` y `easyvet_test`. Añaden FKs compuestas tenant-aware
  `RESTRICT`, checks de lifecycle, `startedAt` requerido al finalizar, `endedAt`
  opcional con orden temporal si existe, observaciones no vacías, límites
  numéricos e índices alineados con el contrato de lectura.
- Se implementaron contratos Zod/DTO, permisos `anesthesia.*`, endpoints de
  historial/detalle/create/update/finalize/void y CRUD de observations, snapshots
  de Patient/Owner histórico/Professional al finalizar, seed ficticio idempotente
  y pruebas reales PostgreSQL. Assistant puede leer/crear/editar drafts y
  observations; no puede finalizar ni anular.
- En esta fase no se creó frontend, Consent, PDF, firma, Storage, inventario,
  billing, Prescription/Medication estructurado, device integration, templates
  ni importación legacy. Procedures/Surgery frontend y hardening estaban
  pendientes entonces y se completaron en Fase 6F.3, registrada abajo.
- QA HTTP real se ejecutó únicamente sobre `easyvet_dev`: health/login,
  creación standalone, creación ligada a Surgery finalizada, validación de
  timestamp con offset, update Draft, add/update/delete/list de observations,
  conflictos 409 por stale y observation vacía, finalize con `endedAt = null`,
  inmutabilidad posterior, void, rechazo de link cross-tenant, Assistant
  create/updateDraft sin finalize y deep link cross-tenant 404. Los registros
  QA ficticios permanecen en `easyvet_dev`; no se hizo hard delete.
- No-side-effects verificado: Appointments permaneció en 12 y Prescriptions en
  10 antes/después del QA. Solo crecieron `AnesthesiaRecord` y
  `AnesthesiaObservation` por los datos QA autorizados.
- Validaciones finales completadas: `format:check`, `lint`, `typecheck`,
  `npm test`, `test:db`, `test:all`, `build`, `prisma:generate` y
  `prisma:validate` pasan. `test:db` ejecutó 137 pruebas; `test:all` repitió
  correctamente la suite no-DB y la suite PostgreSQL.
- `npm audit` informa 5 paquetes afectados: 3 altos en la cadena Prisma
  CLI/config/deepmerge-ts y 2 moderados en Vitest/@vitest/mocker. No se aplicó
  `npm audit fix --force`; los fixes ofrecidos son breaking/downgrade mayor.
  No se identificó riesgo real de runtime API Easyvet para esta fase porque el
  servidor no ejecuta Vitest ni procesa configuración Prisma controlada por
  usuarios.

Fase 6F.3 — Procedures/Surgery/Anesthesia frontend, hardening y cierre:

- Se implementaron rutas independientes y deep-linkable para historial,
  detalle, creación y edición Draft de procedimientos/cirugías y anestesia;
  el detalle Surgery se integra con el kind del procedimiento.
- La UI usa permisos efectivos `procedures.*` y `anesthesia.*`, ofrece lectura
  parcial por dominio, CRUD de observaciones anestésicas en Draft, presenta
  cero como valor válido y mantiene lectura histórica de snapshots.
- Los recursos clínicos se aíslan por organización durante lecturas y cambios
  de tenant. En el QA manual se descartó un texto de formulario Norte sin
  guardar, y su deep link devolvió “Recurso no encontrado” al cambiar a Sur.
  En vista de paciente de Sur a 390 px no hubo overflow horizontal.
- Se actualizó la documentación de API, transacciones, autorización y
  decisiones; se añadió la guía frontend y la matriz legacy final. Consent,
  documentos/PDF, firma, medicamentos estructurados, dispositivos, catálogos,
  inventario, facturación, datos históricos externos y plantillas
  configurables siguen POSTERGADOS, no son bugs de esta fase.
- QA manual con registros ficticios se ejecutó exclusivamente en `easyvet_dev`;
  los registros permanecen sin hard delete. No se modificaron Appointment,
  Prescription, seed ni migraciones. El cambio backend de 6F.3 permite retirar
  o cambiar un vínculo anestésico Draft cuando el Procedure vinculado fue
  anulado, y se agregó regresión de integración.
- Batería final (22-sep-2026): `format:check`, `lint`, `typecheck`, `npm test`,
  `test:db`, `test:all`, `build`, `prisma:generate` y `prisma:validate`
  finalizaron correctamente. `npm test` ejecutó 293 pruebas frontend y 5
  pruebas API sin DB; omitió 133 pruebas que requieren DB. `test:db` pasó con
  138 pruebas (133 DB-gated + 5 API comunes).
- Build aprobado con advertencias no bloqueantes: anotaciones Zod removidas por
  Rollup y chunk JS principal de 811.03 kB (235.20 kB gzip), sobre el umbral
  configurado de 500 kB.
- QA con registros ficticios solo en `easyvet_dev`; Docker/PostgreSQL estuvo
  disponible y healthy. Conteos finales: 12 Appointments, 10 Prescriptions,
  13 ClinicalProcedures, 9 AnesthesiaRecords y 7 AnesthesiaObservations. No se
  modificaron citas, prescripciones, seed ni migraciones; no se hicieron
  hard-deletes. No se creó commit.
- Tenant switch Norte a Sur, descarte del formulario no guardado y deep link
  cross-tenant se verificaron manualmente; el recurso de Norte respondió 404.
  El layout a 390 px no mostró overflow horizontal. Se verificó la advertencia
  de Anesthesia FINALIZED con Procedure VOIDED. No se mutó un ClinicalEncounter,
  por lo que el caso manual Procedure FINALIZED + Encounter VOIDED quedó fuera
  del QA autorizado; el estado se conserva visible en la UI y los tests de
  backend cubren las transiciones/races del padre.
- `npm audit` reportó 5 vulnerabilidades: 2 moderadas relacionadas con Vitest /
  `@vitest/mocker` y 3 altas en la cadena de configuración/herramientas Prisma /
  `deepmerge-ts`. Vitest es dev-only; la cadena Prisma aparece también en el
  árbol `--omit=dev` vía dependencia/peer de `@prisma/client`, pero el hallazgo
  identificado afecta herramientas/configuración y no expone una ruta de
  entrada de datos controlados por usuario en el runtime API actual. No se
  encontró actualización patch/minor compatible; no se ejecutó `audit fix`.
- `prisma:generate` tuvo inicialmente un `EPERM` al reemplazar el engine DLL
  mientras el servidor de desarrollo lo mantenía abierto; después de detener
  el servidor, el comando pasó. PostgreSQL continúa como verificado localmente
  en `easyvet_dev`; no se afirmó ninguna verificación de producción.

Fase 6G — Hospitalization / Ambulatorio completo: COMPLETADA

- Hospitalization: COMPLETADO.
- Hospitalization backend: COMPLETADO.
- Hospitalization frontend: COMPLETADO.
- Hospitalization Kardex: COMPLETADO.
- Hospitalization hardening: COMPLETADO.
- La migración 20260922120000_add_hospitalizations y el seed idempotente fueron aplicados/verificados únicamente en easyvet_dev y easyvet_test.
- La suite de integración PostgreSQL de Hospitalization cubre lifecycle, permisos clínicos, tenant isolation, snapshots, CAS, Kardex append-only, mediciones, alta, void y no mutación de Patient. La suite frontend cubre rutas, lifecycle y permisos.
- El QA manual y los datos demo de esta fase permanecen limitados a easyvet_dev. No se inició Diagnostics/Exams y no se creó commit.
- Validación final del 22-sep-2026: `format:check`, `lint`, `typecheck`, `npm test`, `test:db`, `test:all`, `build`, `prisma:generate` y `prisma:validate` finalizaron correctamente; `test:db` cubrió 142 pruebas y la suite web llegó a 296 pruebas.
- Docker Engine 29.8.0 / Compose v5.5.1 y `easyvet-postgres-1` permanecen disponibles y `healthy`; la configuración local verificada apunta a `easyvet_dev`, sin afirmar verificación de producción.
- `npm audit` reporta 5 hallazgos actuales (2 moderados en Vitest/@vitest/mocker, dev-only, y 3 altos agregados en la cadena Prisma/deepmerge-ts). No hay actualización patch/minor segura identificada; no se ejecutó `npm audit fix --force`.

Fase 6H — Diagnostics / Exámenes / Ayudas diagnósticas: COMPLETADA

- Revisión legacy del commit `05fea495cb13208b27bf470b3570987fd501a81e`:
  ayudas diagnósticas reutilizaban consultas genéricas con `document_reference`
  y estado libre; Exámenes era principalmente un selector/resumen, sin un
  agregado relacional tenant-safe para su lifecycle. El comparativo está en
  `docs/migration/diagnostics-final-review.md`.
- Se implementó el aggregate único `DiagnosticOrder`, categorías
  `LABORATORY`, `IMAGING`, `PATHOLOGY` y `OTHER`, y lifecycle
  `DRAFT → REQUESTED → RESULTED → VOIDED`; no se añadieron tablas de resultados,
  documentos ni archivos. La migración
  `20260922130000_add_diagnostic_orders` se aplicó únicamente a
  `easyvet_dev` y `easyvet_test`.
- API y contratos compartidos incluyen lectura por paciente, detalle, creación
  contextual por encuentro, edición Draft con CAS, request, result y void. Los
  locks protegen carreras con Encounter VOIDED y Patient ARCHIVED. Request
  congela los snapshots de Patient, Owner histórico y Practitioner; los
  resultados y narrativa clínica no se copian a los eventos de auditoría.
- Practitioners pueden solicitar, registrar resultados y anular; Clinical
  Assistants pueden leer y crear/editar Draft, pero no solicitar, registrar
  resultados ni anular. Patient archivado permite lectura y anulación, pero
  bloquea el resto de mutaciones; Encounter anulado bloquea nuevas mutaciones
  sin cambiar automáticamente el estado de órdenes existentes.
- Frontend lazy-loaded y deep-linkable en historia de paciente y encuentro;
  incluye lista, detalle, formulario Draft, confirmación de request, resultado,
  anulación, avisos de Patient/Encounter y recarga explícita ante stale. El
  cambio de tenant limpia los borradores sin guardar. Documentación añadida en
  `docs/architecture/diagnostics*.md` y actualizada en data model,
  autorización y transacciones.
- Seed idempotente: cuatro órdenes ficticias (Norte: DRAFT/REQUESTED/RESULTED;
  Sur: DRAFT). El primer seed QA reveló metadatos terminales obsoletos en una
  hospitalización demo estable; el seed ahora reinicia de forma determinista
  esos campos opcionales al estado definido. No se añadieron registros QA al
  seed.
- QA manual ficticio exclusivamente en `easyvet_dev`: Practitioner creó,
  editó, solicitó, revisó, registró resultado y anuló; Assistant creó/editó
  Draft y no vio acciones de request/result/void. La navegación cross-tenant
  directa devolvió 404. Lista, detalle, formulario, review y modales de
  resultado/anulación se comprobaron a 390 px, sin overflow horizontal.
  Tres órdenes manuales permanecen: dos `VOIDED` con su evidencia y una Draft
  creada/editada por Assistant. No hubo hard delete.
- No-side-effects en `easyvet_dev`: 12 Appointments, 10 Prescriptions y peso
  actual de Luna `12.4 kg`, sin cambios tras el QA. Conteo de DiagnosticOrders:
  7 (cuatro seed y tres QA). No se crearon Documents, reminders, ventas ni
  facturas.
- Infraestructura verificada localmente: Docker Engine 29.8.0, Compose 5.5.1 y
  `easyvet-postgres-1` `healthy`; `DATABASE_URL` apunta a `easyvet_dev`.
  `npm run dev` inició API y frontend; `GET /api/v1/health` respondió 200.
  No se afirmó prueba en una base compartida o productiva.
- Validaciones finales pasan: `format:check`, `lint`, `typecheck`, `npm test`,
  `npm run test:db`, `npm run test:all`, `npm run build`,
  `npm run prisma:generate` y `npm run prisma:validate`. `npm test` pasó con
  303 pruebas frontend y 7 pruebas API comunes; 143 API DB-gated quedaron
  omitidas en esa pasada. `test:db` pasó con 150/150 pruebas API y `test:all`
  repitió satisfactoriamente ambas suites. Build: advertencias no bloqueantes
  de anotaciones de Zod/Rollup y chunk principal de 820.64 kB (237.09 kB gzip),
  sobre el umbral configurado de 500 kB.
- `npm audit` informa 5 entradas (3 altas y 2 moderadas; dos advisories):
  `deepmerge-ts` bajo la configuración/CLI de Prisma y
  `@vitest/mocker` bajo Vitest. Prisma figura además en `--omit=dev` por el
  peer opcional de `@prisma/client`, pero el servidor Easyvet utiliza Prisma
  Client y no ejecuta el CLI ni expone la fusión de configuración a entradas
  de usuario. No se identificó un camino explotable en el runtime actual. Los
  fixes ofrecidos requieren cambios mayores; no se ejecutaron upgrades ni
  `npm audit fix --force`.
- No quedan bugs funcionales conocidos de 6H. Documents/Consents/Signatures y
  cualquier módulo posterior no se iniciaron.

Fase 6I — Documents / Consents / Signatures: COMPLETADA

- Revisión legacy de solo lectura en Lativet-reference commit
  `05fea495cb13208b27bf470b3570987fd501a81e`: Consent se persistía como firma ya
  finalizada, producía PDF y correo SMTP si estaba configurado; solicitudes OTP
  por consulta conservaban bearer token en claro y dibujo como Data URL, aunque
  limitaban intentos/expiración y detectaban cambios del documento. La comparación
  completa está en `docs/migration/documents-consents-signatures-final-review.md`.
- Prisma añade `ClinicalDocument`, `Consent` y `ConsentSignatureRequest`, enums,
  checks/FKs tenant-composite e índices en
  `20260922170000_add_documents_consents_signatures`. Aplicada/verificada solo en
  `easyvet_dev` y `easyvet_test`; no se modificó el seed ni bases compartidas o
  productivas.
- `StorageService` selecciona driver local privado o S3-compatible configurable.
  QA ejerció local en `.easyvet-storage`; no había credenciales/servicio S3 para
  probar el proveedor remoto. No se emiten URLs públicas; void conserva bytes.
- Documentos: seis PDFs clínicos + PDF de Consent firmado, upload PDF/PNG/JPEG
  hasta 10 MiB, magic/MIME, SHA-256 server-side, idempotencia por source/version,
  descargas autenticadas verificadas y anulación lógica. Consent usa Draft/Issue/
  Signed/Void, snapshots y content hash al emitir, CAS, bearer de 256 bits solo en
  claro una vez, OTP Argon2id, expiración/intentos, reissue con revocación y firma
  TYPED/DRAWN con hash de evidencia y PDF firmado.
- QA ficticio manual exclusivamente en `easyvet_dev`: se descargaron los seis
  PDFs de source; se subieron PDF y PNG; el PDF se anuló y siguió descargable; tres
  Consent quedaron SIGNED mediante typed, drawn y flujo real del navegador. Se
  comprobó OTP incorrecto controlado, reissue, hash PNG/PDF y aislamiento Sur→Norte
  (404, sin exposición de storage). No se borró físicamente ningún artefacto.
- UI interna y firma pública medidas en viewport 390×844. Listas/detalle y el flujo
  de firma typed completado no presentan overflow horizontal. Se corrigió el
  encabezado responsive de la tarjeta de upload. El navegador reportó solo las
  respuestas 401 esperadas del sondeo global `auth/me` después de limpiar la
  sesión; la ruta pública cargó y firmó sin autenticación.
- Conteo final en `easyvet_dev`: 11 ClinicalDocuments (9 generados activos; 2
  cargados: 1 activo y 1 voided), 3 Consent SIGNED y 6 SignatureRequests (3 signed,
  3 revoked; ninguno pending). No-side-effects verificado: 12 Appointments, 10
  Prescriptions y peso actual de Luna `12.4 kg`.
- Se añadieron dependencias runtime `pdfkit@0.20.2` y
  `@aws-sdk/client-s3@3.1138.0`, además de tipos de desarrollo. Ninguna de las
  dependencias nuevas aparece en los advisories de `npm audit`.
- Validaciones finales: `format:check`, `lint`, `typecheck`, `npm test`,
  `npm run test:db`, `npm run test:all`, `npm run build`,
  `npm run prisma:generate` y `npm run prisma:validate` pasan. Suite web: 312/312;
  API `test:db`: 172/172. Build incluye avisos no bloqueantes de anotaciones Zod/
  Rollup y chunk principal 827.13 kB (238.34 kB gzip).
- `npm audit`: 5 vulnerabilidades (2 moderadas en Vitest y 3 altas en Prisma/
  deepmerge-ts). El camino alto es configuración/CLI Prisma opcional de desarrollo;
  no se halló uso del merge vulnerable con entradas del runtime. Los únicos fixes
  propuestos fuerzan cambios breaking; no se ejecutaron upgrades ni
  `npm audit fix --force`.
- Limitaciones POST-V1: email/SMS de firma, firmas cualificadas/certificadas,
  plantillas, antivirus, OCR, DICOM, PDF integral de historia, DOCX editable,
  generación masiva y reglas nacionales de Consent. El alcance 6I termina aquí;
  FollowUps / Reminders se registra como Fase 6J a continuación.

## Fase 6J — FollowUps / recordatorios internos

- Se añadió el agregado `ClinicalFollowUp`, contratos, permisos, API, cola,
  historia Patient, detalle, operaciones de create/edit/complete/void y widget
  de dashboard. No se creó entidad `Reminder` ni se implementaron notificaciones
  externas, evolución/consulta sintética, next-follow-up ni Appointment automático.
- Migración `20260922231809_clinical_follow_ups` aplicada únicamente a
  `easyvet_dev` y `easyvet_test`. Al reconciliar el estado físico con Prisma,
  también normaliza nombres de índices existentes de Diagnostics/Hospitalization
  (recreándolos con nombres/campos equivalentes) y de FKs/índices de
  Documents/Consents/Diagnostics; no modifica filas de esos dominios.
- El seed incluye 4 seguimientos ficticios Norte (3 OPEN y 1 COMPLETED) y 1 OPEN
  ficticio Sur, con fechas relativas a `America/Bogota`.
- QA manual ficticio solo en `easyvet_dev`: se creó, editó, asignó, completó y
  anuló desde la UI un seguimiento de Luna asociado a un Encounter finalizado;
  permanece `VOIDED` como registro histórico. Se verificaron vencido/hoy/próximo,
  recordatorio pendiente, filtros, historia Patient, detalle, dashboard, warning
  de Encounter, permisos Practitioner/Assistant, tenant switch Norte→Sur y
  deep link cross-tenant 404. A 390 px, cola, formularios, modales e historia no
  muestran overflow horizontal. No hubo hard delete.
- No-side-effects confirmado por pruebas: completion no crea Appointment,
  Encounter, Evolution ni Reminder y no modifica peso del Patient. No se enviaron
  notificaciones ni se crearon Documents, ventas o facturas.
- Docker Engine 29.8.0, Compose 5.5.1; `easyvet-postgres-1` `healthy`.
  `DATABASE_URL` se confirmó como `easyvet_dev`; health local devolvió 200.
- Validaciones: `format:check`, `lint`, `typecheck`, `npm test`, `npm run test:db`,
  `npm run test:all`, `npm run build`, `npm run prisma:generate` y
  `npm run prisma:validate` completadas correctamente. `npm test`: 25 pruebas API
  pasaron (155 DB-gated omitidas en esa ejecución) y 319 web pasaron;
  `test:db`: 180/180 API pasaron. Build sin advertencia de importación mixta;
  permanecen advertencias no bloqueantes de anotaciones Zod/Rollup y chunk
  principal de 847.61 kB (242.91 kB gzip), sobre el umbral configurado de 500 kB.
- `npm audit` en cierre Fase 6J: 5 entradas (3 high en `prisma` → `@prisma/config` →
  `deepmerge-ts`; 2 moderate en Vitest/`@vitest/mocker`). `prisma` y Vitest son
  dependencias dev directas; `deepmerge-ts` y `@vitest/mocker`, transitivas.
  `--omit=dev` conserva el camino Prisma porque `@prisma/client` declara el peer
  opcional `prisma`; la vulnerabilidad de merge está en el CLI/config y no se
  encontró invocación desde handlers/API. El advisory Vitest está limitado a
  tooling/mockers. El audit no ofrece actualización patch/minor compatible: sus
  propuestas son un downgrade/breaking para Prisma y salto mayor para Vitest.
  No se aplicaron upgrades ni `npm audit fix --force`.
- Sin bugs funcionales conocidos pendientes en Fase 6J. Limitaciones POST-V1: email/SMS/
  WhatsApp/push, recurrencia, automatización de siguiente seguimiento o cita,
  campañas, calendario externo y preferencias de notificación. Fase 6J cerrada.

## Fase 7 — Grooming / Peluquería

- Se agregó el agregado operacional `GroomingVisit`, el lifecycle DRAFT →
  IN_PROGRESS → COMPLETED/VOIDED, CAS, snapshots, restricciones tenant-safe,
  `OperationalAuditEvent`, API y matriz de permisos. No hay DELETE ni cruces
  automáticos con Agenda, Clinical, ventas o inventario.
- Migración `20260923000000_grooming_module` aplicada únicamente a
  `easyvet_dev` y `easyvet_test`; ambas verificadas al día. PostgreSQL local
  healthy y Docker Engine 29.8.0 / Compose 5.5.1.
- Seed idempotente con 4 visitas ficticias (Norte DRAFT/IN_PROGRESS/COMPLETED;
  Sur DRAFT), Groomer y Recepción de demostración.
- Arquitectura, API, frontend y revisión legacy documentadas en
  `docs/architecture/grooming*.md` y
  `docs/migration/grooming-final-review.md`.
- QA manual ficticio exclusivamente en `easyvet_dev`: Groomer creó y editó un
  borrador, inició atención, actualizó notas/incidentes operativos y completó;
  el HTML introducido se mostró como texto literal. Reception creó y editó un
  borrador incompleto y no vio acciones de inicio/cierre. Owner anuló dos
  registros completados con motivo obligatorio, conservando su historial y sin
  borrado físico.
- Se creó una cita futura desde Agenda para Nala/Sede Norte, se vinculó desde
  el selector Grooming compatible, y se verificó en el resumen de START. Tras
  iniciar, completar y anular Grooming, Agenda conservó `SCHEDULED` (Programada).
  La historia del Patient mostró Grooming en la sección operacional separada de
  la historia clínica.
- Tenant QA: una identidad Groomer ficticia y temporal con membresías Norte/Sur
  cambió de tenant en la UI. La cola Sur solo mostró sus registros y un deep link
  a Grooming Norte respondió 404. La identidad temporal se eliminó al terminar;
  las visitas QA se conservaron.
- Responsive QA: cola, formulario, detalle e historial verificados a 390 px;
  no hubo overflow horizontal en 390, 768 ni 1280 px. Las confirmaciones de
  inicio, finalización y anulación se operaron desde la UI.
- START y edición activa requieren permisos efectivos (`grooming.perform`);
  `grooming.complete` permite cerrar aunque el actor no sea el Groomer asignado.
  Assignment se conserva como responsabilidad/snapshot, no como autorización.
- Sin efectos comerciales o clínicos comprobados por pruebas de integración:
  no se crearon ventas, facturas, cobros, movimientos de inventario, encounters,
  evoluciones, diagnósticos ni cambios de peso. Grooming no cambia el estado de
  Appointment. No quedan bugs funcionales conocidos pendientes.
- Validaciones: `format:check`, `lint`, `typecheck`, `npm test`, `npm run test:db`,
  `npm run test:all`, `npm run build`, `npm run prisma:generate` y
  `npm run prisma:validate` pasan. `npm test`: API 26 passed / 168 DB-gated
  skipped; web 329/329. `test:db`: 194/194. Build pasa con anotaciones Zod que
  Rollup elimina y el warning no bloqueante del bundle principal de 852.19 kB
  (243.60 kB gzip) sobre el umbral de 500 kB; chunk Grooming: 30.46 kB
  (7.98 kB gzip).
- `npm audit`: 5 vulnerabilidades (2 moderate, 3 high; 0 critical). Vitest y
  Prisma CLI son directas de desarrollo; `@vitest/mocker`, `@prisma/config` y
  `deepmerge-ts` son transitivas. `npm audit --omit=dev` conserva 3 high porque
  `@prisma/client` declara Prisma como peer opcional; el advisory alto reside en
  configuración/CLI de Prisma y no en los handlers ni consultas del API. El
  advisory moderado de Vitest afecta al mocker/herramienta de pruebas. No se
  identificó una ruta explotable en el runtime actual de Easyvet. El audit solo
  propone cambios breaking; no se hicieron upgrades ni se ejecutó
  `npm audit fix --force`.
- Limitaciones POST-V1: ServiceCatalog, precios/paquetes, consumo de inventario,
  venta/factura automática, fotos antes/después, consentimiento específico de
  grooming, notificaciones, reserva online y recurrencia de citas. Fase 7
  completada; Inventory no iniciado.

## Fase 8 — Inventory / Inventario

- Legacy review del commit `05fea495cb13208b27bf470b3570987fd501a81e` completado
  en modo lectura. Lativet concentra producto, stock y parte del consumo comercial
  en un modelo mutable, permite editar/eliminar movimientos y asocia vencimiento
  principalmente al producto; Easyvet conserva catálogo, lotes y ledger separados,
  y reserva futuras relaciones de compras/ventas para sus propios dominios.
- Se agregaron `InventoryItem`, `InventoryBatch` e `InventoryMovement`, con FKs
  tenant-safe, `RESTRICT`, unicidad SKU/lote por organización, checks de signo,
  cantidades `Decimal(20,6)`, costos no negativos y protección PostgreSQL para
  ledger append-only, stock no negativo, lotes requeridos y pares de transferencia.
  Stock actual se calcula siempre desde `SUM(quantityDelta)`; no hay balance mutable.
- La migración `20260923010000_inventory_module` se aplicó únicamente a
  `easyvet_dev` y `easyvet_test`. `easyvet_dev` reporta 23 migraciones aplicadas y
  esquema al día; `test:db`/`test:all` ejercitan `easyvet_test`. No se tocaron bases
  productivas ni se creó una migración adicional.
- El API ofrece catálogo, detalle, edición/archivo, resumen/stock derivado,
  lotes, movimientos y transferencias bajo `/api/v1/inventory/*`. Los contratos
  compartidos serializan decimales como strings. Salidas/ajustes negativos se
  validan dentro de una transacción con bloqueo del artículo; transferencia crea
  ambos movimientos con UUID común en una sola transacción. `occurredAt` es
  instante con zona y `expiryOn` se mantiene como DATE civil.
- Se agregaron permisos `inventory.*`: Owner/Admin gestionan el módulo; roles
  operativos conservan lectura y la cuenta de plataforma no evita el aislamiento
  tenant. El mínimo se evalúa por ubicación, con el mismo umbral por artículo;
  vencido/próximo a vencer se deriva usando fecha local de la organización. No hay
  notificaciones ni consumo automático clínico/comercial.
- La ruta `/inventario` ahora es lazy-loaded e incluye filtros por sede/tipo/stock/
  estado, métricas, cards móviles, detalle por ubicación/lote, ledger de solo lectura,
  formularios y diálogos de recepción, salida, ajuste y traslado. Las acciones se
  filtran por permiso; el cambio de tenant reinicia filtros/recursos y aborta
  solicitudes obsoletas. Conflicto `INSUFFICIENT_STOCK` refresca el stock sin reintento.
- Seed idempotente y ficticio: Norte tiene medicamentos lotificados, venta al detal
  y suministros en dos sedes; incluye mínimo bajo, lote vencido y próximo a vencer.
  Sur tiene catálogo/stock independientes. QA manual se hizo solo en `easyvet_dev`:
  alta de suministro, recepción `+10.125`, salida `−3.125`, conflicto de stock
  insuficiente, ajustes `+2.5/−1.5`, traslado de 3 entre sedes y recepción lotificada
  vencida `+2.5` con vencimiento civil `15/01/2025`. Se archivó un artículo ficticio
  de stock cero; permanece histórico, sin hard delete.
- Tenant QA Norte→Sur desde Inventario comprobó que la sede seleccionada se limpia,
  Sur solo muestra su propio artículo y un deep link al artículo Norte devuelve 404.
  El modal largo de recepción pudo recorrerse/confirmarse a 390 px tras corregir el
  scroll interno. Lista y detalle no desbordan horizontalmente a 390, 768 y 1280 px;
  los detalles móviles presentan cards para lotes y movimientos.
- Docker Engine 29.8.0 / Compose 5.5.1; `easyvet-postgres-1` permanece `healthy`.
  El `DATABASE_URL` local se verificó como `localhost/easyvet_dev` sin mostrar
  credenciales; health respondió 200. Ningún dato real se ingresó.
- QA automatizado cubre aislamiento, permisos, SKU, decimales, lotes/fecha civil,
  entradas/salidas/ajustes, transferencias, archivo, DB append-only, concurrencia
  ISSUE/ISSUE y traslado/ISSUE, filtros/stock, formularios, ledger seguro, acciones
  UI, permisos y aborto de consultas al cambiar tenant. La carrera permite cualquiera
  de los dos órdenes serializados válidos y exige que solo una operación consuma stock.
- Validaciones finales: `format:check`, `lint`, `typecheck`, `npm test`, `npm run
test:db`, `npm run test:all`, `npm run build`, `npm run prisma:generate` y
  `npm run prisma:validate` pasan. Suite unitaria: API 27/27 y web 353/353;
  `test:db`: 205/205. Build pasa; advertencias no bloqueantes de anotaciones Zod/
  Rollup y chunk principal 860.55 kB (245.52 kB gzip), sobre el umbral de 500 kB;
  el chunk Inventory es 3.53 kB (1.56 kB gzip).
- `npm audit`: 5 vulnerabilidades (2 moderate y 3 high; 0 critical). `vitest@3.2.7`
  y `prisma@6.19.3` son dependencias directas de desarrollo; `@vitest/mocker`,
  `@prisma/config` y `deepmerge-ts` son transitivas. El camino Prisma aparece también
  en `npm audit --omit=dev` por el peer opcional de Prisma Client, pero el riesgo
  reside en la configuración/CLI de desarrollo, no en una ruta encontrada en los
  handlers del runtime. Las únicas propuestas automáticas son cambios breaking
  (Vitest 5 y downgrade forzado de Prisma); no se cambió ninguna dependencia ni se
  usó `npm audit fix --force`.
- Bugs encontrados y corregidos durante QA: casteos UUID para consultas SQL raw;
  conservar el diálogo de salida al recibir 409 mientras se refresca el mismo recurso;
  scroll de diálogos largos en viewport corto; tolerancia del header cuando un preview
  no entrega la lista de membresías. Se corrigió además una expectativa de test de
  carrera que asumía que el traslado siempre obtenía primero el lock. No quedan bugs
  funcionales conocidos. Limitaciones POST-V1: proveedores, compras/cuentas por
  pagar, costeo FIFO/promedio, mínimos por sede, códigos de barra/seriales,
  sugerencias, reservas, conteos, cuarentena e integraciones de almacén.
- Fase 8 Inventory completada. Sales/Billing/Cash se implementa y cierra en Fase 9 a continuación.

## Fase 9 — Sales / Billing / Cash

- Se incorporaron ventas tenant-scoped con líneas de producto/servicio/otros,
  snapshots comerciales, pagos mixtos, versión CAS, anulación lógica y auditoría.
  El dinero conserva precisión `DECIMAL(20,4)`/strings decimales; cantidades
  conservan `DECIMAL(20,6)`. No se almacenan datos de tarjeta.
- Completar una venta actualiza el ledger de inventario y pagos en una transacción:
  `SALE_OUT` negativo se registra exactamente una vez por línea inventariable,
  y el void añade `SALE_REVERSAL_IN` positivo sin editar ni borrar historia.
  Una insuficiencia de stock deja la operación intacta. El reverso conserva la
  sede histórica incluso si después se inactiva.
- Billing genera una Invoice interna inmutable con numeración secuencial por
  Organization; no es factura electrónica, documento fiscal ni integración DIAN.
  Caja mantiene sesiones por sede, apertura, ingresos/retiros manuales con motivo,
  pagos cash vinculados, saldo ledger, cierre con conteo/diferencia y concurrencia
  CAS. No hay reembolsos electrónicos ni conciliación de tarjeta.
- Se añadieron settings comerciales de Organization e idempotencia de seed; el
  seed aporta únicamente catálogo/stock ficticios, sin ventas QA precargadas. Se
  actualizaron contratos, permisos por rol, API, rutas lazy `/ventas`,
  `/facturacion` y `/caja`, sidebar y documentación de arquitectura, API,
  transacciones y frontend. Las limitaciones y revisión final están en
  `docs/migration/commercial-final-review.md`.
- Migraciones `20260923110000_inventory_sale_movement_types`,
  `20260923120000_commercial_sales_billing_cash` y
  `20260923130000_commercial_trigger_corrections`; la última corrige la
  ambigüedad PL/pgSQL de `lot_tracking` observada en pruebas. No se modificaron
  migraciones previas ni se reseteó ninguna base.
- Suites PostgreSQL en `easyvet_test`: comercial 8/8 (incluye finalización
  simultánea, reemplazo de Draft vs Complete, void vs void y void vs cierre),
  autenticación 46/46, inventario 13/13 y suite completa `test:db` 214/214.
  `test:all` se repitió al cierre; los resultados finales se reflejan abajo.
- QA manual ficticio únicamente en `easyvet_dev`: se abrió Caja Norte con
  $100.000 COP; se comprobaron venta de producto con Patient Luna/Owner Camila,
  consumidor final con pagos mixtos, venta Owner-only, servicio sin efecto de
  stock, venta voided y reversión, insuficiencia de stock sin efectos parciales,
  entradas/salidas manuales y cierre en $130.000 con diferencia cero. Quedaron
  cinco ventas QA (2 COMPLETED, 3 VOIDED), cinco comprobantes consecutivos y
  pagos/movimientos compensatorios; sin hard delete ni registros en seed.
- Tenant switch Norte→Sur no expuso ventas ni caja Norte; deep link de venta
  cross-tenant respondió 404 genérico. La membresía temporal usada para verificar
  el cambio de tenant fue retirada al terminar, sin filas comerciales dependientes.
  A 390 px no hubo overflow horizontal en ventas, formulario, facturación,
  detalle de comprobante ni caja. No se afirma una verificación manual de
  impresión física/media print ni de todos los anchos tablet.
- No se observaron Appointment, ClinicalEncounter, Prescription, Grooming,
  ClinicalDocument ni cambios en el peso de Luna atribuibles a ventas.
- `npm audit` reportó 5 paquetes afectados (3 HIGH, 2 MODERATE) en 2 advisories;
  los dos caminos son herramientas de desarrollo/configuración y no hay una
  actualización patch/minor compatible que elimine todos los hallazgos. No se
  actualizaron dependencias ni se ejecutó `npm audit fix --force`. Análisis y
  límites de explotación constan en `docs/migration/commercial-final-review.md`.
- `npm run build` terminó correctamente. Vite advierte que el chunk principal
  minificado (868,63 kB; 247,08 kB gzip) excede 500 kB; los módulos comerciales
  se entregan en chunks lazy separados. Se conserva como aviso de rendimiento,
  no como fallo funcional.
- Cierre final completado: formato, lint, typecheck, pruebas unitarias/API y web,
  pruebas PostgreSQL, build, generación Prisma y validación del schema pasan.
  No quedan bugs funcionales conocidos; restricciones funcionales restantes
  corresponden a límites post-V1 documentados en la revisión final.

## Users / Settings / Reports 10

- Estado: **COMPLETADA**. El cambio obligatorio de contraseña se completó
  manualmente en `easyvet_dev`; la contraseña no se registró ni se incluyó en
  esta documentación.

- `User` sigue siendo una identidad global; el acceso se concede/revoca por
  `Membership` de la organización activa. El onboarding normaliza el correo,
  genera contraseña temporal criptográfica para cuentas nuevas y obliga el
  cambio en primer ingreso. Cuentas existentes conservan contraseña y rol de
  plataforma; `OrganizationAuditEvent` guarda únicamente tenant, actor, entidad,
  acción y metadatos mínimos.
- La migración `20260923140000_admin_settings_reports` añade
  `User.mustChangePassword`, auditoría administrativa append-only y moneda
  snapshot en sesiones de caja existentes. Fue aplicada a `easyvet_dev` y
  `easyvet_test`; no se crearon entidades de dominio ni se resetearon bases.
- `/usuarios`, `/configuracion`, `/informes` y `/cambiar-contrasena` están
  separados por ruta y lazy-loaded. Permisos se derivan del rol organizacional y
  `ClinicalRole`; OWNER queda sujeto al invariante de un propietario activo,
  serializado con lock de Organization. El cambio de contraseña revoca todas las
  demás sesiones del User.
- Configuración se divide en General, Sedes y Comercial. Inactivar sede bloquea
  caja abierta, Grooming en curso y citas bloqueantes; los dominios que crean
  operaciones sincronizan locks de sede. La moneda comercial y el prefijo solo
  cambian defaults/documentos futuros y no renumeran ni recalculan historia.
- Los informes operacional, clínico, comercial e inventario son agregados
  tenant-scoped con rangos civiles de hasta 366 días en timezone de Organization.
  Ningún endpoint devuelve filas clínicas/pacientes; valores de distintas
  monedas se agrupan por separado.
- La revisión acotada del legacy de usuarios, configuración e informes se guarda
  en [`admin-reports-final-review.md`](docs/migration/admin-reports-final-review.md).
  La UI extiende el diseño actual de Easyvet. QA ficticio en `easyvet_dev`
  confirmó login con contraseña temporal, redirección obligatoria a
  `/cambiar-contrasena` y posterior cambio manual de contraseña. Se editaron y
  restauraron los settings generales, y se creó/editó/inactivó una sede temporal
  segura.
- Los cuatro informes se contrastaron contra agregaciones SQL independientes en
  `easyvet_dev` para los datos existentes; las cifras de agenda, seguimientos,
  clínica, peluquería, hospitalización, ventas, facturas, pagos e inventario
  coincidieron. No se alteraron evidencias clínicas, ventas, caja, stock, citas
  ni pesos de Patient. El tenant switch Norte→Sur mantuvo informes y permisos
  aislados; se corrigió el uso de un endpoint de settings administrativo al
  inicializar el reporte operacional del rol Practitioner.
- Se verificó el rechazo de degradar y suspender al único OWNER activo. La
  resolución simultánea de invariantes OWNER y los flujos de sesión se cubren
  además con pruebas de integración. No se observaron bugs funcionales
  pendientes durante el QA realizado.
- `npm run test:all` pasó: web 370/370 y PostgreSQL 228/228. También pasaron
  `format:check`, `lint`, `typecheck`, `build` y `prisma:validate`. Tras el QA,
  una lectura limitada a `easyvet_dev` confirmó usuario `ACTIVE`, membership
  `RECEPTION/ACTIVE`, `mustChangePassword=false` y hash presente. El modelo
  persiste `passwordHash`, no texto plano. La única sesión encontrada está
  vigente; no había sesiones adicionales que revocar. Al recargar el dashboard,
  el AppShell siguió autenticado mediante la restauración de sesión de
  `AuthProvider` (`GET /auth/me`). El acceso directo al puerto API desde el
  navegador auxiliar fue bloqueado por el navegador, por lo que el status HTTP
  del endpoint no se capturó por separado.
- Los servidores de QA se detuvieron y los puertos locales quedaron libres.
  `npm run prisma:generate` y `npm run prisma:validate` pasaron después del
  cierre. Durante la detención, el watcher de API registró reinicios con
  `Cannot find module .../apps/api/dist/main`; API y frontend respondían antes
  de la detención. Se trata como inestabilidad del watcher local durante el
  cierre, no como bug funcional confirmado; no se modificó código por ello.
  `npm audit` reportó 5 hallazgos de desarrollo en dos dependencias transitivas,
  sin actualización patch/minor compatible; no se modificaron dependencias. El
  build mantiene el aviso del chunk principal (872,03 kB minificado; 247,76 kB
  gzip), fuera del alcance de esta fase.
- El cierre documental y la revisión de secretos se completaron para el commit
  único `feat(admin): complete users settings and reports`; no se hizo push.
