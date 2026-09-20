# Preparación multi-tenant

## Frontera de aislamiento

`Organization` es la frontera principal del tenant. Toda entidad futura que
pertenezca a una veterinaria deberá incluir `organizationId` y sus consultas
deberán recibir explícitamente esa organización.

```text
User ──< Membership >── Organization ──< ClinicLocation
```

Un `User` puede tener memberships en varias organizaciones. Una sede nunca
reemplaza a `Organization` como límite de seguridad.

## Regla de acceso

En Fase 3A no se implementa `TenantContext`, filtros automáticos ni guards.
Los servicios de organizaciones, memberships y sedes encapsulan el acceso a
Prisma y dejan una frontera explícita para los futuros casos de uso tenant-aware.
El acceso debe seguir la forma conceptual:

```text
useCase(input, organizationId) -> query where organizationId = organizationId
```

No se deben aceptar consultas clínicas sin un `organizationId` explícito cuando
esas entidades sean creadas en fases posteriores.

## Plataforma versus organización

`PlatformRole.PLATFORM_ADMIN` administra Easyvet como producto. `MembershipRole.ADMIN`
administra una organización concreta. Ninguno de los dos conceptos debe
mezclarse y el primero no implica visibilidad global de datos clínicos.

## Ubicación de la estrategia

Los servicios Nest de esta fase son límites pequeños de persistencia; no se
introduce un repository pattern genérico. La regla de aislamiento permanece
en los casos de uso explícitos hasta que Fase 3C defina guards y permisos.
