# Estado de migración

| Área                         | Estado                                                    |
| ---------------------------- | --------------------------------------------------------- |
| Auditoría legacy             | Completada                                                |
| Monorepo                     | Completado                                                |
| React/Vite                   | App shell y base visual de Fase 2 completados             |
| NestJS                       | Infraestructura; Nest 12.0.3 verificado                   |
| PostgreSQL                   | VERIFICADO LOCALMENTE                                     |
| Prisma                       | Modelos Fases 3A/3B/4A y migraciones aplicados localmente |
| Core tenant model            | COMPLETADO (Fase 3A)                                      |
| Multi-tenancy                | Fundación de aislamiento completada (Fase 3C)             |
| Autenticación                | COMPLETADA (Fase 3B)                                      |
| Autorización                 | COMPLETADA (Fase 3C)                                      |
| UI Lativet                   | Referencia analizada; adaptación React completada         |
| Owners backend               | COMPLETADO (Fase 4A)                                      |
| Patients backend             | COMPLETADO (Fase 4A)                                      |
| Owners frontend              | COMPLETADO (Fase 4B)                                      |
| Patients frontend            | COMPLETADO (Fase 4B)                                      |
| Owners/Patients final review | COMPLETADO (Fase 4C)                                      |
| Agenda analysis/design       | COMPLETADO (Fase 5A)                                      |
| Agenda backend               | PENDIENTE FASE 5B                                         |
| Agenda frontend              | PENDIENTE FASE 5C                                         |
| Agenda hardening             | PENDIENTE FASE 5D                                         |
| Clínica                      | Pendiente                                                 |
| Inventario                   | Pendiente                                                 |
| Facturación                  | Pendiente                                                 |
| SaaS                         | Pendiente                                                 |
| Multi-tenancy SaaS completo  | EN PROGRESO                                               |

La base visual de Fase 2 no significa que una funcionalidad de negocio esté migrada.

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
- No se modificaron `prisma/schema.prisma`, migraciones, endpoints, UI,
  Owners/Patients ni permisos. Fase 5B no se inició.
- PostgreSQL/Docker conserva el estado `VERIFICADO LOCALMENTE` registrado en el
  checkpoint 4D; esta fase no simula verificación de producción ni de una base
  compartida.

Para detener el entorno local:

```bash
docker compose down
```

No se documentan contraseñas locales reales.
