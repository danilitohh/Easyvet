# Easyvet — auditoría de producción (2026-10-17)

Esta nota registra comprobaciones no destructivas realizadas sobre el proyecto
desplegado y separa los controles cerrados de los que aún requieren una acción
de infraestructura o datos sensibles.

## Controles verificados

| Control                      | Evidencia                                                                                                                                                                                                            | Estado                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Web Analytics                | Vercel Dashboard → Analytics muestra Web Analytics habilitado para el plan Hobby. La consulta de pageviews para producción respondió correctamente con `visitors: 0` y `pageviews: 0` para 2026-10-15 a 2026-10-17.  | Verificado              |
| Consentimiento de analítica  | El cliente solo monta `@vercel/analytics` cuando la aplicación está en producción y la persona ha aceptado la analítica opcional. La sanitización elimina query strings, hashes, IDs UUID y rutas públicas de firma. | Verificado en `42c815c` |
| Despliegue                   | El deployment asociado a `d4cd38b` está en estado Ready y la URL canónica responde `200`.                                                                                                                            | Verificado              |
| Asesor de seguridad Supabase | La consulta del asesor de seguridad del proyecto `iykzaqtcewnxgrmlbinz` devolvió `lints: []` el 2026-10-17.                                                                                                          | Verificado              |
| Realtime tenant              | La migración de broadcasts terminó correctamente tras un intento revertido; existe la política privada esperada en `realtime.messages` y hay 40 triggers de cambio tenant instalados en tablas públicas.             | Verificado estructural  |
| Storage privado              | El bucket `easyvet-clinical-documents` existe como privado, con límite de 10 MB y MIME PDF/PNG/JPEG; no tiene políticas públicas y el acceso se mantiene server-side.                                                | Verificado estructural  |

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

La migración `20261017090000_add_tenant_rls_context` ya reemplazó la política
amplia por predicados RLS tenant-aware y el contexto se establece por transacción
antes de las operaciones Prisma. Permanece como riesgo separado la prueba
negativa end-to-end con dos tenants y el rol runtime de producción; la API sigue
siendo la frontera principal y RLS funciona como defensa adicional. La evidencia
del rollout está en
[`tenant-rls-rollout-2026-10-17.md`](tenant-rls-rollout-2026-10-17.md).

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

La verificación SQL posterior confirmó que la migración de Realtime tiene un
registro finalizado y otro intento anterior revertido, que la política de
`realtime.messages` está instalada y que existen 40 triggers
`easyvet_realtime_organization_change`. Esto prueba la instalación estructural,
no una entrega de broadcast extremo a extremo en un navegador autenticado.

## Pendientes fuera de este control

- Prueba real autorizada de carga y descarga de un archivo sintético en Storage.
- Verificación de proveedor de correo y una restauración controlada. El
  procedimiento y los límites conocidos están documentados en
  [`docs/operations/backup-recovery.md`](../operations/backup-recovery.md);
  todavía no se ha probado contra producción ni se han confirmado el plan, la
  retención o el RPO/RTO de la cuenta.
- Prueba de carga autorizada con usuarios/concurrencia y volúmenes representativos; ya existe un baseline automatizado y no destructivo para listas paginadas sobre PostgreSQL efímero en CI.
- Datos legales reales y revisión profesional antes del lanzamiento comercial.

El asesor de rendimiento de Supabase reportó 137 claves foráneas sin índice de
cobertura. Es una lista de candidatos, no una orden para crear índices en
bloque: la siguiente fase debe priorizar consultas reales, planes `EXPLAIN`,
latencias y tráfico representativo, porque agregar 137 índices también aumenta
el coste de escritura y mantenimiento.
