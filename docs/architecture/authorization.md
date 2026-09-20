# Autorización y aislamiento multi-tenant (Fase 3C)

## Authentication vs authorization

La autenticación global valida la cookie HttpOnly y adjunta la identidad
`request.auth`. Todas las rutas requieren sesión por defecto. Solo `GET
/api/v1/health` y `POST /api/v1/auth/login` están marcadas con `@Public()`.

La autorización se evalúa después de autenticar:

```text
Session.activeMembershipId
        ↓
Membership(userId, organizationId, role, status)
        ↓
Organization(status)
        ↓
TenantContext + PermissionGuard
```

`TenantContext` contiene únicamente `organizationId`, `membershipId`, `role` y
`userId`. Se construye en servidor después de comprobar la sesión, el usuario,
la pertenencia al usuario y los estados `ACTIVE` de membership y organización.
Los controladores tenant usan `@CurrentTenant()` y no leen `organizationId` de
body, query, headers ni rutas.

Si una sesión autenticada no tiene membership activa seleccionada, las rutas
tenant responden `403 ACTIVE_ORGANIZATION_REQUIRED`. Si la membership u
organización deja de ser válida, se aplica la misma política.

## Permisos y roles

Los permisos son un catálogo type-safe en código; no existen tablas
`Permission` ni `RolePermission`:

- `organization.read`, `organization.update`
- `locations.read`, `locations.manage`
- `memberships.read`, `memberships.manage`

`@RequirePermissions(A, B)` usa semántica ALL. `PermissionGuard` resuelve la
matriz por `TenantContext.role`; el frontend solo usa los permisos para UX.

| Rol          | Permisos de Fase 3C                        |
| ------------ | ------------------------------------------ |
| OWNER        | Todos los permisos administrativos básicos |
| ADMIN        | Igual que OWNER en esta fase               |
| VETERINARIAN | `organization.read`, `locations.read`      |
| ASSISTANT    | `organization.read`, `locations.read`      |
| RECEPTION    | `organization.read`, `locations.read`      |
| GROOMER      | `organization.read`, `locations.read`      |
| CASHIER      | `organization.read`, `locations.read`      |

OWNER y ADMIN comparten permisos ahora; OWNER queda reservado semánticamente
para ownership, billing SaaS y operaciones irreversibles futuras. No se crean
permisos clínicos, financieros ni roles personalizados.

## Platform Admin

`PlatformAdminGuard` solo acepta `User.platformRole === PLATFORM_ADMIN` para
`/api/v1/platform/context`. Ese endpoint devuelve identidad técnica mínima y no
lista organizations ni datos clínicos.

Un `PLATFORM_ADMIN` sin membership no puede usar endpoints tenant. Si posee una
membership real, debe pasar por `TenantContext` y por los permisos de esa
membership; no existe bypass de tenant ni impersonation.

## APIs protegidas

- `GET /api/v1/organization/current`: organization activa.
- `PATCH /api/v1/organization/current`: solo `name`, `timezone`, `locale` y
  `currencyCode`, con `organization.update`.
- `GET /api/v1/organization/locations` y `/:locationId`: lecturas filtradas por
  `TenantContext.organizationId`.
- `GET /api/v1/organization/memberships` y `/:membershipId`: lista y detalle con
  usuario mínimo (`id`, `email`, `status`), role y status.
- `GET /api/v1/platform/context`: área separada para Platform Admin.

Las consultas de recursos tenant reciben siempre `organizationId` en la firma y
usan filtros compuestos. Un recurso de otra organization responde `404
RESOURCE_NOT_FOUND`, sin revelar que existe.

## Frontend

`AuthContext` conserva los permisos de la membership activa y los actualiza con
`/auth/me` después de cambiar de organization. `useCan()` y `<Can>` solo ocultan
o deshabilitan acciones para mejorar UX; el backend sigue siendo la autoridad.
Existe una pantalla `AccessDenied` para errores `403`; no se confunde con `404`.

## Límites y futuro

No se implementan RLS de PostgreSQL, audit log completo, impersonation,
invitations, gestión de memberships ni custom roles. RLS puede evaluarse como
defensa en profundidad cuando existan entidades clínicas. Toda entidad futura
tenant-scoped debe consultar por `organizationId` junto con su identificador;
`findUnique({ id })` aislado no es aceptable.
