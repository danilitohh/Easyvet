# Estado de migración

| Área                        | Estado                                                    |
| --------------------------- | --------------------------------------------------------- |
| Auditoría legacy            | Completada                                                |
| Monorepo                    | Completado                                                |
| React/Vite                  | App shell y base visual de Fase 2 completados             |
| NestJS                      | Infraestructura; Nest 12.0.3 verificado                   |
| PostgreSQL                  | VERIFICADO LOCALMENTE                                     |
| Prisma                      | Modelo base y migraciones Fase 3A/3B aplicados localmente |
| Core tenant model           | COMPLETADO (Fase 3A)                                      |
| Multi-tenancy               | Fundación de aislamiento completada (Fase 3C)             |
| Autenticación               | COMPLETADA (Fase 3B)                                      |
| Autorización                | COMPLETADA (Fase 3C)                                      |
| UI Lativet                  | Referencia analizada; adaptación React completada         |
| Pacientes                   | Pendiente                                                 |
| Owners                      | Pendiente                                                 |
| Agenda                      | Pendiente                                                 |
| Clínica                     | Pendiente                                                 |
| Inventario                  | Pendiente                                                 |
| Facturación                 | Pendiente                                                 |
| SaaS                        | Pendiente                                                 |
| Multi-tenancy SaaS completo | EN PROGRESO                                               |

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

Para detener el entorno local:

```bash
docker compose down
```

No se documentan contraseñas locales reales.
