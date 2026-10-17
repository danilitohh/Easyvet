# Easyvet — evidencia de smoke en producción (2026-10-17)

## Resultado

El comando `npm run test:production:smoke` pasó contra `https://easyvet.vercel.app` el 2026-10-17. El deployment observado antes de la ejecución, `dpl_2TaG61vWFcnwLWtQXC1cskTeuY5R` (commit `c481ed3`), estaba en estado `READY`.

Se verificaron mediante solicitudes `GET`, sin escribir datos:

- `/`
- `/login`
- `/registro`
- `/recuperar-contrasena`
- `/privacidad`
- `/terminos`
- `/cookies`
- `/reembolsos`
- `/api/v1/health`
- `/api/v1/health/ready`

En las diez respuestas se comprobaron los headers de seguridad configurados. En los endpoints de salud también se verificaron `cache-control: no-store`, `x-request-id`, `status: ok` y la dependencia `database: ok` en readiness.

Esta comprobación no sustituye una prueba autenticada multi-tenant, una prueba de carga ni una restauración de backup.
