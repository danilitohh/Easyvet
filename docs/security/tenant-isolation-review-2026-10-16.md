# Easyvet — revisión estática del aislamiento multi-tenant

**Fecha:** 2026-10-16  
**Alcance:** código NestJS/Prisma, esquema, pruebas de integración presentes y configuración del job de CI.  
**Método:** revisión estática y lectura de pruebas; no se enviaron cargas de explotación ni se modificó la base de datos.

## Controles observados

| Frontera | Evidencia | Evaluación |
| --- | --- | --- |
| Selección de clínica | `apps/api/src/authorization/tenant-context.service.ts` vuelve a consultar la membresía por `id` y `userId`, exige membresía y organización activas, y deriva `organizationId` de la fila obtenida. Ignora cualquier `tenant` precargado por el request. | Implementado en servidor; no depende del tenant elegido en el cliente. |
| Guard de tenant | `apps/api/src/authorization/tenant-context.guard.ts` establece el contexto después de autenticación. `PermissionGuard` exige contexto y evalúa permisos con el rol actual de la membresía. | Implementado; ausencia de contexto o permiso deniega. |
| Operaciones de negocio | En la muestra revisada, Owner y Appointment filtran por organización; Sales usa bloqueo/lectura tenant-scoped y claves compuestas para mutaciones. En registros clínicos secundarios, la lectura del padre y la relación hijo-padre se valida con tenant dentro de la transacción antes de mutar. | Buen patrón en las rutas revisadas; la auditoría estática no demuestra formalmente que toda consulta de cada módulo sea tenant-safe. |
| Rol de plataforma | `PlatformAdminGuard` protege `PlatformController`; la consola devuelve metadatos administrativos y no consulta datos clínicos. Las pruebas auth comprueban que un super admin sin membresía no puede entrar a la organización. | Separación de privilegios implementada en las rutas revisadas. |
| Pruebas entre clínicas | Hay pruebas explícitas en auth/owners/patients, appointments, clinical, prescriptions, preventive care, procedures, anesthesia, hospitalizations, diagnostics, consents, follow-ups, grooming, inventory y commercial. | Cobertura significativa de regresión; no sustituye probar con el rol de runtime ni verificar todos los predicados de todas las consultas. |

## Límites importantes de la evidencia

- El job `.github/workflows/ci.yml` crea `veterinary` como `LOGIN SUPERUSER`. Por tanto, las pruebas de integración demuestran las reglas explícitas de Prisma/servicio, pero **no** prueban el comportamiento de RLS con el rol de la aplicación ni una configuración de mínimo privilegio.
- La auditoría de catálogo de Supabase registrada en `docs/migration/SECURITY_AUDIT.md` encontró RLS deshabilitado en las tablas de negocio y sin privilegios directos de tablas/esquema para `anon` y `authenticated`; `api_rate_limit_buckets` es la excepción con RLS forzado. La API es la frontera de acceso observada para los datos de negocio.
- No se confirmó qué rol usa Prisma en Production. La cuenta del navegador disponible actualmente redirige a `/login`, y no se ingresaron credenciales. El rol `postgres` del editor SQL no prueba el rol del runtime.
- No se habilita RLS aquí: hacerlo sin confirmar el rol y probar sus políticas puede romper la API sin impedir necesariamente el acceso previsto.
- No se ejecutó Strix ni una prueba de penetración: la herramienta usa payloads que pueden cambiar datos y requiere autorización específica. Este informe no es una certificación de seguridad.

## Resultado y siguiente control

En la revisión estática no se confirmó un bypass cross-tenant en las rutas y patrones examinados. Los filtros server-side y varias restricciones relacionales ofrecen controles útiles; permanece pendiente una verificación de mínimo privilegio y RLS con el rol efectivo de Production, además de ampliar de forma sistemática la revisión de cada consulta tenant-scoped.

El siguiente paso seguro para RLS es obtener el **nombre del rol efectivo de Prisma** mediante la vista protegida de postura de base de datos del super admin. Con ese dato se puede preparar una prueba en una base efímera con un rol equivalente antes de proponer cambios SQL de producción.
