# Autorización y aislamiento multi-tenant (Fases 3C, 4A y 6B.1)

La autorización clínica se suma como una dimensión independiente a la matriz
operativa. `Membership.clinicalRole` puede ser `PRACTITIONER`,
`CLINICAL_ASSISTANT` o `null`; nunca reemplaza `MembershipRole`. Los permisos
clínicos se resuelven junto con los organizacionales y no se conceden por
`PLATFORM_ADMIN` sin Membership activo en el tenant.

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
- `owners.read`, `owners.create`, `owners.update`, `owners.archive`
- `patients.read`, `patients.create`, `patients.update`, `patients.archive`
- `appointments.read`, `appointments.create`, `appointments.update`,
  `appointments.cancel`, `appointments.checkIn`, `appointments.start`,
  `appointments.complete`, `appointments.markNoShow`
- `availability.read`, `availability.manage`

`@RequirePermissions(A, B)` usa semántica ALL. `PermissionGuard` resuelve la
matriz por `TenantContext.role`; el frontend solo usa los permisos para UX.

| Rol          | Permisos de Owner/Patient                                  |
| ------------ | ---------------------------------------------------------- |
| OWNER        | Todos                                                      |
| ADMIN        | Todos                                                      |
| VETERINARIAN | `owners.read/create/update`; `patients.read/create/update` |
| ASSISTANT    | `owners.read`; `patients.read/create/update`               |
| RECEPTION    | `owners.read/create/update`; `patients.read/create/update` |
| GROOMER      | `owners.read`; `patients.read`                             |
| CASHIER      | `owners.read`; `patients.read`                             |

| Rol           | Permisos de Agenda                                                                       |
| ------------- | ---------------------------------------------------------------------------------------- |
| OWNER / ADMIN | Todos los permisos de Agenda y disponibilidad                                            |
| VETERINARIAN  | `appointments.read/create/update/checkIn/start/complete/markNoShow`; `availability.read` |
| ASSISTANT     | `appointments.read/create/update/checkIn`; `availability.read`                           |
| RECEPTION     | `appointments.read/create/update/cancel/checkIn/markNoShow`; `availability.read`         |
| GROOMER       | `appointments.read`                                                                      |
| CASHIER       | `appointments.read`                                                                      |

OWNER y ADMIN comparten la matriz administrativa amplia, con una diferencia de
autoridad aplicada en el servicio: solo OWNER puede gestionar Memberships OWNER.
ClinicalRole sigue siendo una dimensión separada.

## Platform Admin

`PlatformAdminGuard` solo acepta `User.platformRole === PLATFORM_ADMIN` para
`/api/v1/platform/context`. Ese endpoint devuelve identidad técnica mínima y no
lista organizations ni datos clínicos.

Un `PLATFORM_ADMIN` sin membership no puede usar endpoints tenant. Si posee una
membership real, debe pasar por `TenantContext` y por los permisos de esa
membership; no existe bypass de tenant ni impersonation.

## APIs protegidas

- `GET /api/v1/organization/current`: organization activa para lectura general.
- `GET /api/v1/organization/settings` y `PATCH /api/v1/organization/current`:
  configuración general, protegida por `organizationSettings.read/update`.
- `GET/PATCH /api/v1/organization/commercial-settings`: moneda y prefijo
  comerciales; nunca expone `nextInvoiceNumber`.
- `GET /api/v1/organization/locations` y `/:locationId`: lecturas filtradas por
  `TenantContext.organizationId`.
- `GET /api/v1/organization/memberships` y `/:membershipId`: compatibilidad de
  lectura con proyección mínima, sin ID ni estado global de User.
- `GET/POST /api/v1/organization/members`, detalle, `PATCH` y acciones
  `suspend`/`reactivate`: administración paginada y tenant-scoped de Membership.
- `POST /api/v1/auth/change-password`: cambio autenticado de credencial global.
- `POST /api/v1/organization/locations` y cambios PATCH/deactivate/activate:
  configuración de sedes con guards para operaciones abiertas.
- `GET /api/v1/reports/{operational,clinical,commercial,inventory}`: agregados
  acotados por tenant, rango civil y permiso por informe.
- `GET/POST /api/v1/owners`, `GET/PATCH /api/v1/owners/:ownerId` y
  `POST /api/v1/owners/:ownerId/archive`: CRUD seguro, paginado, búsqueda y
  archive por tenant.
- `GET/POST /api/v1/patients`, `GET/PATCH /api/v1/patients/:patientId` y
  `POST /api/v1/patients/:patientId/archive`: CRUD seguro, paginado, búsqueda y
  archive por tenant. El Owner se valida dentro del mismo tenant.
- `GET/POST /api/v1/appointments`, detalle, edición limitada y acciones
  explícitas de reprogramación, cancelación, check-in, inicio, completado,
  no-show y confirmación; todos tenant-safe.
- `GET/POST/PATCH/DELETE /api/v1/availability-rules` y
  `GET /api/v1/agenda/available-slots`, protegidos por permisos de
  disponibilidad y rango limitado.
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

No se implementan RLS de PostgreSQL, impersonation, invitations ni custom roles.
`OrganizationAuditEvent` cubre cambios administrativos mínimos, no constituye
un audit log exhaustivo de lectura. RLS puede evaluarse como defensa en
profundidad cuando existan entidades clínicas. Toda entidad futura
tenant-scoped debe consultar por `organizationId` junto con su identificador;
`findUnique({ id })` aislado no es aceptable.

## Grooming / Peluquería 7

La matriz organizacional agrega `grooming.read`, `grooming.create`,
`grooming.updateDraft`, `grooming.perform`, `grooming.complete` y
`grooming.void`. OWNER y ADMIN tienen todos; GROOMER tiene todos salvo `void`;
RECEPTION puede leer, crear y editar Draft; VETERINARIAN y CASHIER son solo
lectura; ASSISTANT no recibe acceso por defecto. `grooming.perform` se evalúa
como permiso efectivo para opciones y validación del Membership Groomer; ningún
rol o `PLATFORM_ADMIN` omite el tenant activo. El endpoint devuelve únicamente
id, nombre visible y rol operativo del Groomer. Ver
[`grooming-api.md`](grooming-api.md).

## Inventory 8

OWNER y ADMIN reciben `inventory.read`, `inventory.items.create/update/archive`,
`inventory.movements.create`, `inventory.adjustments.create` y
`inventory.transfers.create`. VETERINARIAN, ASSISTANT, RECEPTION, GROOMER y
CASHIER reciben solo `inventory.read`. Las rutas de ajuste y traslado requieren
su permiso dedicado además del permiso de movimiento cuando corresponda.
PLATFORM_ADMIN mantiene el requisito de tenant activo. Véase
[`inventory-api.md`](inventory-api.md).

## Sales / Billing / Cash 9

Los permisos comerciales se resuelven por `MembershipRole` dentro del tenant
activo. `sales.void` queda reservado a OWNER/ADMIN; Reception puede operar
borradores y completar ventas, pero solo consulta facturas y caja. CASHIER puede
operar ventas y caja, sin anular ventas. VETERINARIAN, ASSISTANT y GROOMER no
reciben acceso comercial por defecto.

| Rol           | Permisos comerciales                                                  |
| ------------- | --------------------------------------------------------------------- |
| OWNER / ADMIN | Todos los permisos Sales, Billing y Cash                              |
| CASHIER       | Todos salvo `sales.void`                                              |
| RECEPTION     | `sales.read/create/updateDraft/complete`, `billing.read`, `cash.read` |
| VETERINARIAN  | Ninguno                                                               |
| ASSISTANT     | Ninguno                                                               |
| GROOMER       | Ninguno                                                               |

Billing es lectura de facturas internas inmutables; no habilita facturación
electrónica ni fiscal. Ningún rol, incluida la cuenta `PLATFORM_ADMIN`, puede
omitir `TenantContext` ni acceder a registros comerciales de otra Organization.

## Users / Settings / Reports 10

OWNER y ADMIN tienen `members.read/create/update/suspend`,
`organizationSettings.read/update`, permisos de gestión de sedes y los cuatro
permisos de informes. Solo OWNER puede cambiar una Membership OWNER; ADMIN puede
gestionar los demás roles. El invariante de al menos un OWNER activo se serializa
con lock de Organization.

| Fuente del permiso                | Permisos adicionales                                |
| --------------------------------- | --------------------------------------------------- |
| RECEPTION                         | `reports.operational.read`                          |
| GROOMER                           | `reports.operational.read` (incluye peluquería)     |
| CASHIER                           | `reports.commercial.read`                           |
| `ClinicalRole.PRACTITIONER`       | `reports.clinical.read`, `reports.operational.read` |
| `ClinicalRole.CLINICAL_ASSISTANT` | Ninguno por defecto                                 |

Inventory report y settings no se conceden a roles operativos por defecto.
VETERINARIAN solo obtiene reportes clínicos cuando además tiene
`ClinicalRole.PRACTITIONER`. Los permisos clínicos no cambian `MembershipRole`.
