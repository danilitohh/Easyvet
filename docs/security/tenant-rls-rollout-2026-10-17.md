# Easyvet — rollout de RLS por tenant

**Estado:** aplicado y verificado en producción
**Despliegue:** `d4cd38b` (`fix: bind rate limit queries to system transaction`)

La migración fue autorizada, ejecutada por `prisma migrate deploy` y quedó
registrada como aplicada antes del despliegue actual. El build de Vercel
reportó 43 migraciones encontradas y ninguna pendiente.

## Qué se preparó

- `DatabaseSecurityContext` usa `AsyncLocalStorage` para separar solicitudes
  concurrentes y empieza cada request en modo `deny`.
- La autenticación y las rutas de control de plataforma establecen el modo
  `system`; `TenantContextGuard` cambia el request a la organización validada
  por la membresía activa.
- Prisma establece `app.easyvet_context` y
  `app.easyvet_organization_id` dentro de la misma transacción que cada
  operación de modelo.
- La migración `20261017090000_add_tenant_rls_context` reemplaza la política
  amplia `easyvet_runtime_server` por una política que filtra por
  `organization_id`. También cubre `organizations`, `users`,
  `prescription_items`, `subscription_plans` y las tablas globales de sesión y
  rate limit.
- La prueba de integración preparada crea dos organizaciones, comprueba que
  cada scope solo ve sus propietarios y rechaza una escritura cruzada.

## Evidencia local

| Comprobación                      | Resultado                                                                |
| --------------------------------- | ------------------------------------------------------------------------ |
| `npm run lint`                    | Correcto                                                                 |
| `npm run typecheck`               | Correcto                                                                 |
| `npm run build`                   | Correcto                                                                 |
| Pruebas nuevas de contexto/Prisma | 5 correctas                                                              |
| Suite API local                   | 40 suites correctas; 17 suites DB omitidas por falta de PostgreSQL local |
| Suite web local                   | 47 archivos y 414 pruebas correctas                                      |
| `prisma validate`                 | Correcto con una URL PostgreSQL temporal de validación                   |
| Vercel `prisma migrate deploy`    | 43 migraciones encontradas; ninguna pendiente                            |
| `GET /api/v1/health/ready`        | HTTP 200; `database: ok`                                                 |
| Integración RLS local (2026-10-18) | 43 migraciones aplicadas en PostgreSQL temporal; 1/1 prueba de dos tenants correcta con el rol runtime `veterinary` seguro |

La integración RLS local con dos tenants pasó usando datos sintéticos y el rol
runtime `veterinary` sin privilegios peligrosos. Los contenedores temporales
`easyvet-tenant-test-pg` y `easyvet-tenant-test-pg2` fueron eliminados después
de la prueba. La prueba autenticada completa contra dos sesiones y la
verificación de Realtime siguen siendo controles separados antes del lanzamiento.

## Cierre de la autorización y controles restantes

La autorización para aplicar `20261017090000_add_tenant_rls_context` fue
recibida y el deployment quedó `READY`. El endpoint público de readiness
respondió HTTP 200 con `database: ok`; los logs del build confirmaron que no
había migraciones pendientes.

Continúa como control operativo independiente la prueba autorizada con dos
sesiones autenticadas y dos tenants, además de la verificación de Realtime. No
se debe interpretar el readiness ni esta integración RLS aislada como sustitutos
de esa prueba negativa completa.
