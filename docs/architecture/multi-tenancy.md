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

Fase 3B añade un guard de sesión y Fase 3C añade `TenantContextGuard`,
`PermissionGuard` y `PlatformAdminGuard`. El contexto siempre se deriva de la
membership activa de la sesión; no se acepta un tenant enviado por el cliente.
Los servicios de organizaciones, memberships y sedes reciben explícitamente
`organizationId` para cada consulta tenant-aware.
El acceso debe seguir la forma conceptual:

```text
useCase(input, organizationId) -> query where organizationId = organizationId
```

No se deben aceptar consultas clínicas sin un `organizationId` explícito cuando
esas entidades sean creadas en fases posteriores.

Regla obligatoria para entidades futuras: ninguna consulta tenant-scoped puede
usar únicamente un id de recurso. El patrón incorrecto es `findUnique({ id })`;
el patrón correcto es conceptualmente:

```text
findFirst({ id, organizationId: tenant.organizationId })
```

## Plataforma versus organización

`PlatformRole.PLATFORM_ADMIN` administra Easyvet como producto. `MembershipRole.ADMIN`
administra una organización concreta. Ninguno de los dos conceptos debe
mezclarse y el primero no implica visibilidad global de datos clínicos.

## Ubicación de la estrategia

Los servicios Nest de esta fase son límites pequeños de persistencia; no se
introduce un repository pattern genérico. La regla de aislamiento permanece en
los casos de uso explícitos; Fase 3C no crea un repositorio genérico ni un motor
de permisos dinámico.
