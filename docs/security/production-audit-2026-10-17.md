# Easyvet — auditoría de producción (2026-10-17)

Esta nota registra comprobaciones no destructivas realizadas sobre el proyecto
desplegado y separa los controles cerrados de los que aún requieren una acción
de infraestructura o datos sensibles.

## Controles verificados

| Control                     | Evidencia                                                                                                                                                                                                            | Estado                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Web Analytics               | Vercel Dashboard → Analytics muestra Web Analytics habilitado para el plan Hobby. La consulta de pageviews para producción respondió correctamente con `visitors: 0` y `pageviews: 0` para 2026-10-15 a 2026-10-17.  | Verificado              |
| Consentimiento de analítica | El cliente solo monta `@vercel/analytics` cuando la aplicación está en producción y la persona ha aceptado la analítica opcional. La sanitización elimina query strings, hashes, IDs UUID y rutas públicas de firma. | Verificado en `42c815c` |
| Despliegue                  | El deployment asociado a `d4cd38b` está en estado Ready y la URL canónica responde `200`.                                                                                                                            | Verificado              |

## Actualización posterior: rol runtime corregido

La remediación autorizada se completó y verificó en producción. El rol
runtime dedicado `veterinary` quedó configurado sin superusuario ni
`BYPASSRLS`; la variable `DATABASE_URL` cifrada se configuró únicamente para
Production en Vercel. La conexión administrativa de migraciones continúa
separada en `POSTGRES_URL_NON_POOLING`.

La verificación posterior confirmó 48 tablas públicas de aplicación con RLS
habilitado y forzado, y el endpoint protegido de postura respondió
`role=veterinary`, `bypassesRowLevelSecurity=false` y `superuser=false`. El
health check de producción también confirmó la conexión de base de datos.

La evidencia completa, incluidos el despliegue corregido y el límite de la
política server-side actual, está en
`docs/security/runtime-role-remediation-2026-10-17.md`.

## Auditoría de catálogo Supabase

La consulta de solo lectura ejecutada el 2026-10-17 devolvió 48 tablas
públicas de aplicación; las 48 tienen RLS habilitado y forzado. Los roles
`anon` y `authenticated` tienen 0 grants directos de `SELECT` sobre esas
tablas. Esto confirma que el acceso directo de clientes está cerrado en la
base de datos.

La consulta histórica confirmó que el editor SQL usa `postgres`, que no es
superusuario pero sí tiene `rolbypassrls = true`. Ese dato no representa el
runtime actual de Vercel: la verificación posterior confirmó que Prisma usa
`veterinary` sin bypass.

## Riesgo crítico ya cerrado en esta fase

El riesgo de que el runtime de Prisma usara `postgres` con
`bypassesRowLevelSecurity: true` quedó corregido. La conexión runtime ahora usa
`veterinary`, sin superusuario ni bypass. La contraseña no se registra en el
repositorio ni en esta auditoría.

Permanece como riesgo separado el aislamiento RLS por tenant: la política
server-side actual es amplia y la API sigue siendo la frontera principal. Debe
probarse un contexto de organización por transacción antes de convertir esa
política en predicados RLS tenant-aware.

Las migraciones deben continuar usando `POSTGRES_URL_NON_POOLING`, separado de
la conexión runtime.

## Verificación posterior del despliegue actual

El deployment asociado a `d4cd38b` quedó en estado `READY`. Los logs de Vercel
confirmaron que `prisma migrate deploy` encontró 43 migraciones y no tenía
ninguna pendiente. Después de publicar la corrección de contexto `system`,
`GET /api/v1/health/ready` respondió HTTP 200 con
`{"status":"ok","dependencies":{"database":"ok"}}`. El error RLS previo de
`api_rate_limit_buckets` no reapareció en la comprobación posterior.

La revisión de solo lectura en Supabase confirmó que el bucket
`easyvet-clinical-documents` existe, es privado, limita los archivos a 10 MB y
acepta únicamente PDF/PNG/JPEG. El panel mostró cero políticas de Storage; esto
es coherente con el acceso exclusivo del backend mediante service role. No se
realizó una escritura de prueba.

## Pendientes fuera de este control

- Prueba real autorizada de carga y descarga de un archivo sintético en Storage.
- Verificación de proveedor de correo, backups y recuperación.
- Pruebas de rendimiento con volúmenes representativos.
- Datos legales reales y revisión profesional antes del lanzamiento comercial.
