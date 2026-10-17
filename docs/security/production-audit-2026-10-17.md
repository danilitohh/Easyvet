# Easyvet — auditoría de producción (2026-10-17)

Esta nota registra comprobaciones no destructivas realizadas sobre el proyecto
desplegado y separa los controles cerrados de los que aún requieren una acción
de infraestructura o datos sensibles.

## Controles verificados

| Control | Evidencia | Estado |
| --- | --- | --- |
| Web Analytics | Vercel Dashboard → Analytics muestra Web Analytics habilitado para el plan Hobby. La consulta de pageviews para producción respondió correctamente con `visitors: 0` y `pageviews: 0` para 2026-10-15 a 2026-10-17. | Verificado |
| Consentimiento de analítica | El cliente solo monta `@vercel/analytics` cuando la aplicación está en producción y la persona ha aceptado la analítica opcional. La sanitización elimina query strings, hashes, IDs UUID y rutas públicas de firma. | Verificado en `42c815c` |
| Despliegue | El último despliegue asociado a `42c815c` está en estado Ready y la URL canónica responde `200`. | Verificado previamente |

## Auditoría de catálogo Supabase

La consulta de solo lectura ejecutada el 2026-10-17 devolvió 48 tablas
públicas de aplicación; las 48 tienen RLS habilitado y forzado. Los roles
`anon` y `authenticated` tienen 0 grants directos de `SELECT` sobre esas
tablas. Esto confirma que el acceso directo de clientes está cerrado en la
base de datos.

La misma auditoría confirmó que `postgres` no es superusuario, pero sí tiene
`rolbypassrls = true`, y que el rol runtime dedicado `veterinary` aún no existe.

## Riesgo crítico aún abierto

El endpoint protegido de postura de base de datos reportó el rol `postgres` con
`bypassesRowLevelSecurity: true`. La API aplica autorización y filtros por
tenant, pero esto deja a Prisma sin una segunda barrera de RLS en producción.

La corrección requiere crear un rol runtime dedicado sin superusuario ni
`BYPASSRLS` en Supabase y configurar una conexión `DATABASE_URL` de Production
en Vercel. No se ejecutó esa mutación ni se generó/transmitió la contraseña sin
autorización explícita.

Las migraciones deben continuar usando `POSTGRES_URL_NON_POOLING`, separado de
la conexión runtime.

## Pendientes fuera de este control

- Prueba real autorizada de carga y descarga de un archivo sintético en Storage.
- Verificación de proveedor de correo, backups y recuperación.
- Pruebas de rendimiento con volúmenes representativos.
- Datos legales reales y revisión profesional antes del lanzamiento comercial.
