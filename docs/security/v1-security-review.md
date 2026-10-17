# Easyvet V1 — revisión de seguridad

## Alcance y resultado

Revisión de código y configuración en el cierre V1, con suites unitarias/de integración y smoke local. Se verificaron los límites de sesión, tenant, permisos, firma pública, archivos, reportes, errores, logging y operaciones financieras. No se ejecutó un pentest externo. La herramienta automática de revisión profunda disponible en el entorno no llegó a iniciar por una dependencia de runtime local; este documento no la presenta como completada.

## Controles observados

- **Credenciales/sesiones:** Argon2id para passwords; cookie `HttpOnly`, `SameSite=Lax`, `Secure` solo con `NODE_ENV=production`; token aleatorio de sesión y hash SHA-256 almacenado; TTL, rechazo de sesiones vencidas/revocadas, logout y revocación de otras sesiones al cambiar password.
- **Tenant y autorización:** guards de sesión/membresía, permisos de operación en API, consultas acotadas por `Organization`, FKs compuestas en relaciones de dominio y 404 para recursos/membresías ajenos. `PlatformAdmin` no hereda permisos de una organización.
- **CSRF/CORS:** CORS con origen `APP_ORIGIN` exacto y cookies; middleware valida el origen de mutaciones y acepta JSON o multipart solo en dos rutas de carga deliberadas. Un smoke previo de origen no permitido obtuvo 403.
- **Contratos/configuración:** DTOs con whitelist y rechazo de propiedades desconocidas; contratos Zod compartidos; esquema de entorno falla al faltar `DATABASE_URL`/`APP_ORIGIN` o al usar S3 sin su configuración necesaria.
- **Errores:** la API normaliza errores y no devuelve stacks/SQL; el cierre añadió regresión para retirar query values y redactar el token de `/public/signatures/:token` del campo `path` de respuestas de error.
- **Firma pública:** límites separados, rutas dedicadas sin AppShell/sesión tenant. Tokens por ruta son parte deliberada del flujo; no se persisten en almacenamiento web. El acceso autenticado normal no se solicita en `/firmar/*`.
- **Archivos:** la API requiere sesión, permiso y tenant; valida límites de tamaño/tipo/firma mágica, mantiene la clave de almacenamiento interna, y la respuesta inspeccionada incluyó `Content-Type`, `Content-Disposition`, `nosniff` y caché privada/no-store.
- **Datos sensibles:** no se encontraron `localStorage`, `sessionStorage`, `innerHTML` ni `dangerouslySetInnerHTML` en los fuentes revisados. Texto clínico y nombres se renderizan como texto React. El seed es ficticio, requiere una contraseña local provista por entorno y se niega en producción.
- **Integridad:** auditorías, movimientos de inventario y caja, pagos, facturas e históricos comerciales tienen triggers append-only/no-truncate o ciclos de vida compensatorios según dominio.

## Avisos de dependencias al 2026-10-16

Después de sustituir `ts-jest` por `@swc/jest`, `npm audit` reporta 19 vulnerabilidades
moderadas y ninguna alta o crítica; `npm audit --omit=dev --audit-level=high` reporta
0 vulnerabilidades. Las 19 moderadas pertenecen a la cadena de pruebas de Jest/Istanbul
(`sprintf-js` → `argparse`/`js-yaml`/`babel-plugin-istanbul`) y no están en el árbol de
producción. `ts-jest` ya no forma parte de las dependencias.

La cadena de pruebas se mantiene aislada de runtime, se ejecuta solo con fixtures y
datos locales controlados, y no se aplicó `npm audit fix --force` porque proponía
cambios incompatibles de versiones. Debe reevaluarse cuando exista una actualización
compatible de Jest/Istanbul o un reemplazo seguro de esa cadena transitiva.

## Límites de la revisión

- No hubo pentest independiente ni escaneo profundo ejecutable en este entorno.
- El adaptador remoto S3 no se conectó a un servicio real; almacenamiento local sí se usó en smoke.
- El runtime compilado se probó localmente contra la base de desarrollo; no se probó despliegue productivo, proxy TLS, rotación externa de secretos ni infraestructura real.
- Las vulnerabilidades moderadas restantes están restringidas a tooling de pruebas; el árbol de producción no tiene hallazgos de severidad alta.
- No se incluyeron secretos ni hashes de credenciales en este documento.
