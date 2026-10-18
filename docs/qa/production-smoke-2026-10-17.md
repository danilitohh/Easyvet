# Easyvet — evidencia de smoke en producción (2026-10-17)

## Resultado

El comando `npm run test:production:smoke` pasó contra `https://easyvet.vercel.app` el 2026-10-17. El deployment observado antes de la ejecución, `dpl_3sMf7y4Q7WeQP5rXpXMuMo27UHms` (commit `2d709cf`), estaba en estado `READY`.

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

## Reverificación posterior

El mismo smoke se repitió el 2026-10-18 a las 16:12 COT
(2026-10-18T21:12:21Z) contra la URL canónica. Pasó nuevamente con 10 rutas
GET, headers de seguridad, `Cache-Control`, `X-Request-ID` y health/readiness
de base de datos. La prueba siguió siendo solo de lectura: no inició sesión,
no envió datos y no ejecutó mutaciones.
