# Easyvet — verificación de controles en producción (2026-10-16)

**Alcance:** solicitudes HTTP de solo lectura a `https://easyvet.vercel.app` y revisión agregada de métricas PostgreSQL. No se enviaron credenciales, formularios, datos de clínica ni mutaciones.

## Transporte y cabeceras

La respuesta `GET /` devolvió `200` y las cabeceras `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, CSP con `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` restrictiva. Vercel aplica HSTS por defecto en `.vercel.app`; por eso no se agregó una segunda regla a `vercel.json`.

`GET /api/v1/health` devolvió `200 {"status":"ok"}`, `Cache-Control: no-store` y los mismos headers de seguridad. La API reflejó el origen permitido `https://easyvet.vercel.app`. Al probar con `Origin: https://attacker.invalid`, la respuesta siguió exponiendo únicamente `https://easyvet.vercel.app`, no el origen atacante; por política de mismo origen, un navegador no podrá leer esa respuesta desde el origen no permitido.

El `404` observado inicialmente en `/api/health` era una ruta incorrecta: Nest tiene el prefijo global `/api/v1`.

La página estática `/` también devuelve `Access-Control-Allow-Origin: *`. Solo contiene el HTML público de la landing; no es una respuesta de datos autenticados. Conviene conservar la CORS estricta en las rutas de API y no reutilizar ese header abierto para datos privados.

## Señales de rendimiento observadas

`pg_stat_statements` estaba habilitado (`1.11`); su contador se había reiniciado el 2026-10-14 a las 03:10 UTC. En la muestra inspeccionada, el tiempo acumulado estaba dominado por consultas de catálogo/extensiones y consultas operativas de Supabase. Una consulta reconocible de `memberships` aparecía seis veces, con unos 3,2 ms acumulados. Esta muestra no es suficiente para determinar los 137 índices candidatos reportados por el asesor ni representa una prueba de carga.

Antes de añadir índices se requiere tráfico representativo de Easyvet y `EXPLAIN (ANALYZE, BUFFERS)` de consultas identificadas. No se descargaron filas clínicas ni se hicieron cambios de base de datos.
