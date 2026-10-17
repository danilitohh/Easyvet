# Easyvet — rollout de RLS por tenant

**Estado:** preparado; no aplicado en producción
**Motivo:** la migración cambia las políticas activas del rol runtime en las
48 tablas públicas de aplicación y requiere autorización específica antes de
publicarse.

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

La prueba real de PostgreSQL debe ejecutarse en el job `database-integration`
de CI después de publicar, antes de considerar cerrado el rollout.

## Autorización pendiente

Publicar el commit hará que el build de producción ejecute la migración mediante
`prisma migrate deploy`. Antes de hacerlo se debe autorizar expresamente:

> Aplicar en Production la migración `20261017090000_add_tenant_rls_context`
> para reemplazar la política RLS amplia del rol `veterinary` por aislamiento
> basado en la organización validada por el servidor.

Después de esa autorización, el cierre requiere comprobar CI, el estado Ready
de Vercel, `/api/v1/health/ready`, `/api/v1/platform/database-posture` y la
prueba de dos tenants. Si alguna comprobación falla, no se debe ocultar el
error ni continuar con tráfico parcial; se debe detener el rollout y preparar
una migración correctiva explícita.
