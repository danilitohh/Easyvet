# Easyvet — evidencia de smoke en producción (2026-10-17)

## Resultado

El comando `npm run test:production:smoke` pasó contra `https://easyvet.vercel.app` después de que el deployment `dpl_75fuNParTr518APJZvyEhgk8hQj4`, asociado al commit `e125d12`, quedó en estado `READY`.

Se verificaron mediante solicitudes `GET`, sin escribir datos:

- `/`
- `/login`
- `/api/v1/health`
- `/api/v1/health/ready`

En las cuatro respuestas se comprobaron los headers de seguridad configurados. En los endpoints de salud también se verificaron `cache-control: no-store`, `x-request-id`, `status: ok` y la dependencia `database: ok` en readiness.

Esta comprobación no sustituye una prueba autenticada multi-tenant, una prueba de carga ni una restauración de backup.
