# Easyvet — corrección del rol runtime en producción

**Estado:** completada y verificada en producción  
**Fecha de verificación:** 2026-10-17 UTC (16 de octubre de 2026 en Colombia)  
**Alcance:** reducir el privilegio de la conexión Prisma de la API sin exponer
secretos ni cambiar la conexión administrativa usada por migraciones.

## Acción autorizada

Se autorizó crear el rol runtime dedicado `veterinary`, sin superusuario ni
`BYPASSRLS`, y configurar una variable `DATABASE_URL` cifrada únicamente para
Production en Vercel. El valor de la conexión y su contraseña no se registran
en este documento, Git, logs ni respuestas de la aplicación.

La conexión de migraciones permanece separada en `POSTGRES_URL_NON_POOLING`.
El build de producción usa esa conexión administrativa para aplicar migraciones;
el runtime de NestJS usa `DATABASE_URL` y, como fallback, las variables Prisma
existentes.

## Resultado de la base de datos

La verificación de catálogo posterior a la migración confirmó:

| Control                                       | Resultado    |
| --------------------------------------------- | ------------ |
| Rol runtime                                   | `veterinary` |
| `rolsuper`                                    | `false`      |
| `rolbypassrls`                                | `false`      |
| `rolcanlogin`                                 | `true`       |
| `rolcreaterole`                               | `false`      |
| `rolcreatedb`                                 | `false`      |
| Tablas públicas de aplicación con RLS         | 48           |
| Tablas públicas de aplicación con RLS forzado | 48           |

La migración no modifica una contraseña existente si el rol ya estaba creado:
verifica sus atributos y falla de forma segura si son incompatibles. También
deja registrada la migración fallida inicial como `rolled_back` antes de
reaplicarla correctamente; no se ignoró un error de migración activo.

## Resultado de Vercel y runtime

- El primer despliegue falló al intentar modificar atributos de un rol existente
  sin privilegios suficientes. El despliegue corregido resolvió ese estado y
  aplicó la migración con éxito.
- El despliegue de producción `dpl_GdYjrCpyA9TPhYRYfpL4TpADWg8X` terminó en
  estado `READY` y conserva los alias de producción de Easyvet.
- Los logs mostraron `All migrations have been successfully applied`, la
  generación del cliente Prisma, la compilación de contratos/API y la
  finalización del despliegue sin errores.
- `GET /api/v1/platform/database-posture` respondió en producción:
  `{"role":"veterinary","bypassesRowLevelSecurity":false,"superuser":false}`.
- `GET /api/v1/health/ready` respondió `200` con la dependencia de base de datos
  en estado `ok`.

## Riesgo que permanece abierto

La política `easyvet_runtime_server` concede acceso server-side amplio al rol
runtime (`USING (true)` / `WITH CHECK (true)`) para que Prisma pueda operar.
La autorización NestJS, el contexto de organización y los filtros tenant-aware
siguen siendo la frontera principal de aislamiento. Por eso esta fase confirma
el mínimo privilegio de la conexión y la defensa RLS, pero **no** declara
cerrado el aislamiento a nivel de base de datos por tenant.

La siguiente fase de seguridad debe diseñar y probar un contexto de organización
por transacción con dos tenants antes de sustituir esa política amplia por
políticas RLS tenant-aware. No se debe eliminar el acceso del runtime ni cambiar
la política en producción sin esas pruebas.

## Actualización posterior

La fase descrita arriba fue completada después mediante la migración
`20261017090000_add_tenant_rls_context`. El contexto por transacción y los
predicados tenant-aware quedaron aplicados y verificados en el despliegue
posterior. Este documento conserva el estado de la remediación del rol; el
detalle del rollout y la prueba de integración de dos tenants están en
[`tenant-rls-rollout-2026-10-17.md`](tenant-rls-rollout-2026-10-17.md).

## Evidencia técnica versionada

- Migración: `prisma/migrations/20261016230000_create_runtime_veterinary_role/migration.sql`
- Configuración de build/runtime: `vercel.json`
- Endpoint de postura: `apps/api/src/platform/platform.controller.ts`
- Contexto tenant: `apps/api/src/authorization/tenant-context.service.ts`
- Auditoría previa: `docs/security/production-audit-2026-10-17.md`

Los valores de `DATABASE_URL`, contraseñas, tokens y credenciales de Supabase
se excluyen deliberadamente de esta evidencia.
