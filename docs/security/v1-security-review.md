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
- **Frontera servidor/navegador:** el build web verifica que el artefacto no contenga nombres de variables server-only (`DATABASE_URL`, claves de servicio, secretos de bootstrap, correo y credenciales S3). Las variables públicas de Supabase se mantienen separadas y con prefijo explícito de cliente.
- **Analítica y consentimiento:** Vercel Web Analytics solo se monta en producción después de una elección explícita del usuario; la preferencia se guarda localmente. Un filtro `beforeSend` elimina query/hash, neutraliza UUIDs y descarta rutas públicas de firma para no enviar tokens o identificadores de recursos.
- **Integridad:** auditorías, movimientos de inventario y caja, pagos, facturas e históricos comerciales tienen triggers append-only/no-truncate o ciclos de vida compensatorios según dominio.

## Auditoría de dependencias — 2026-10-17

La comprobación ejecutada en el checkout actual confirmó:

- `npm audit --omit=dev`: **0 vulnerabilidades** en las dependencias de producción;
- `npm audit`: **19 vulnerabilidades moderadas** en la cadena de pruebas
  Jest/Istanbul (`sprintf-js` y dependencias transitivas), sin hallazgos altos o
  críticos;
- el arreglo automático disponible propone un cambio mayor de Jest, por lo que
  no se ejecutó `npm audit fix --force` ni se modificó el lockfile.

La cadena afectada es de desarrollo y no forma parte del árbol de producción,
pero debe reevaluarse cuando exista una actualización compatible. Esta evidencia
es puntual y no sustituye la revisión de procedencia, licencias y cambios de
dependencias antes de cada lanzamiento.

## Reverificación de producción — 2026-10-18

`npm audit --omit=dev --audit-level=moderate --json` volvió a reportar **0
vulnerabilidades** en las 291 dependencias de producción auditadas: 0
informativas, bajas, moderadas, altas o críticas. No se ejecutó `npm audit
fix`, no se modificó `package-lock.json` y no se alteró el árbol de desarrollo.

## Límites de la revisión

- No hubo pentest independiente ni escaneo profundo ejecutable en este entorno.
- El adaptador remoto S3 no se conectó a un servicio real; almacenamiento local sí se usó en smoke.
- El runtime compilado se probó localmente contra la base de desarrollo; no se probó despliegue productivo, proxy TLS, rotación externa de secretos ni infraestructura real.
- El árbol de producción no reporta vulnerabilidades; el árbol completo mantiene 19 moderadas de tooling de pruebas. Deben conservarse las barreras de CI y repetir la comprobación cuando cambie el lockfile.
- No se incluyeron secretos ni hashes de credenciales en este documento.
