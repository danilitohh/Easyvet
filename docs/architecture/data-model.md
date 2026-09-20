# Modelo de datos fundamental

## Alcance de Fase 3A

Esta fase define solamente el núcleo multi-tenant. Las entidades clínicas,
autenticación, permisos completos y APIs CRUD quedan para fases posteriores.

```text
User (identidad global)
  │
  └── Membership (relación + rol + estado)
          │
          └── Organization (frontera del tenant)
                  │
                  └── ClinicLocation[] (sedes futuras)
```

## Entidades

- `Organization`: tenant de Easyvet. `slug` es único; `timezone`, `locale` y
  `currencyCode` son configuración mínima, no branding ni suscripción.
- `ClinicLocation`: sede perteneciente a una organización. No es una frontera
  de seguridad independiente.
- `User`: identidad global con email normalizado, hash de contraseña, estado y
  rol de plataforma. No tiene `organizationId`.
- `Membership`: vínculo explícito entre `User` y `Organization`. La combinación
  `userId + organizationId` es única.

## Estados y roles

- `OrganizationStatus`: `ACTIVE` opera normalmente, `SUSPENDED` bloquea la
  operación temporalmente y `ARCHIVED` conserva el tenant fuera de operación.
- `ClinicLocationStatus`: `ACTIVE`, `SUSPENDED` o `ARCHIVED` para una sede.
- `UserStatus`: `ACTIVE` o `SUSPENDED` para la identidad global.
- `MembershipStatus`: `INVITED`, `ACTIVE` o `SUSPENDED`. `INVITED` solo modela
  el estado futuro; no implementa invitaciones.
- `PlatformRole.USER` y `PLATFORM_ADMIN` administran la plataforma Easyvet.
  `PLATFORM_ADMIN` no concede automáticamente acceso a pacientes de ninguna
  organización.
- `MembershipRole`: `OWNER`, `ADMIN`, `VETERINARIAN`, `ASSISTANT`, `RECEPTION`,
  `GROOMER` y `CASHIER`. Estos roles aún no tienen un motor de permisos.

## Constraints e índices

- UUID en todas las claves primarias.
- `User.email` y `Organization.slug` tienen unique constraint.
- `Membership(userId, organizationId)` tiene unique constraint compuesto.
- Índices explícitos en `Membership.organizationId`, `Membership.userId` y
  `ClinicLocation.organizationId`.
- Los servicios normalizan emails a minúsculas antes de escribir o buscar.

## Delete behavior

Las relaciones de `ClinicLocation` y `Membership` hacia sus padres usan
`ON DELETE RESTRICT` y `ON UPDATE CASCADE`. Se evita eliminar por cascada una
organización, usuario o relación de acceso; el estado `ARCHIVED`/`SUSPENDED`
debe usarse para conservar historial. Las migraciones no eliminan datos.

## Estrategia de pruebas

Las pruebas de constraints viven en
`apps/api/src/infrastructure/database/model.integration.spec.ts` y usan una
base PostgreSQL separada (`easyvet_test`). Se ejecutan explícitamente con
`RUN_DB_TESTS=1` y `DATABASE_URL_TEST`; la suite normal no puede borrar ni
modificar `veterinary_saas`. La migración se aplica a la base de pruebas con
`prisma migrate deploy` antes de ejecutar la suite.

La idempotencia del seed se verifica ejecutando `npm run db:seed` dos veces y
comprobando que permanecen 2 organizaciones, 2 sedes, 3 usuarios y 4
memberships.
