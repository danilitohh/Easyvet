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

## Avisos de dependencias al 2026-09-23

`npm audit` reportó 5 vulnerabilidades: 3 altas y 2 moderadas. `npm audit --omit=dev` reportó 3 altas y 0 moderadas. Se conservaron las versiones porque npm solo ofrece remedios major/downgrade (`prisma` a 6.12.0 y `vitest` a 5.0.1); no se hicieron upgrades durante el cierre.

| Paquete afectado | Severidad | Alcance y camino                                                                                                                                                                                                                         | Fix compatible seguro                                                   | Decisión                                                                                                |
| ---------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `prisma`         | Alta      | Dependencia directa de desarrollo; audit también la resuelve como peer opcional de `@prisma/client` en el árbol `--omit=dev`. Hallazgo heredado de `@prisma/config`/`deepmerge-ts`; la API Nest no importa el CLI/config en solicitudes. | No; npm propone downgrade major a 6.12.0.                               | Mantener; no ejecutar CLI de migración/config en runtime. Revaluar con actualización Prisma compatible. |
| `@prisma/config` | Alta      | Transitiva de Prisma CLI; su camino señalado usa `deepmerge-ts`. Presente en el árbol auditado `--omit=dev`, pero no en el camino de request de Nest revisado.                                                                           | No; solución propuesta fuerza Prisma 6.12.0.                            | Mantener temporalmente y limitar su uso a tooling local/CI controlado.                                  |
| `deepmerge-ts`   | Alta      | Transitiva vía `@prisma/config`; advisory de agotamiento de pila al fusionar grafos recursivos. No se encontró entrada de datos HTTP al helper desde Easyvet runtime.                                                                    | No sin actualizar/downgradear Prisma fuera del rango compatible fijado. | Mantener con alcance explícito; no actualizar indirectamente durante V1 closure.                        |
| `vitest`         | Moderada  | Dependencia directa de desarrollo; no aparece en `npm audit --omit=dev`.                                                                                                                                                                 | No; npm ofrece Vitest 5, major respecto a 3.                            | Mantener en tooling de pruebas.                                                                         |
| `@vitest/mocker` | Moderada  | Transitiva de Vitest, dev-only; advisory de path traversal/arbitrary file read por redirect mocks.                                                                                                                                       | No sin Vitest 5 (major).                                                | Mantener en tooling local/CI confiable; no ejecutar fixtures no confiables.                             |

Advisories: [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) y [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). La alerta alta está presente en el grafo de producción que npm reporta, aunque la función vulnerable de Prisma corresponde al camino de configuración/CLI y no fue encontrada en las importaciones del servidor HTTP. Por eso no se clasifica como explotable por una petición normal de Easyvet, pero tampoco se oculta como “solo dev”.

## Límites de la revisión

- No hubo pentest independiente ni escaneo profundo ejecutable en este entorno.
- El adaptador remoto S3 no se conectó a un servicio real; almacenamiento local sí se usó en smoke.
- El runtime compilado se probó localmente contra la base de desarrollo; no se probó despliegue productivo, proxy TLS, rotación externa de secretos ni infraestructura real.
- Las vulnerabilidades de Prisma/tooling siguen abiertas; el riesgo de runtime actual parece bajo por reachability, no nulo para operaciones de CLI/configuración.
- No se incluyeron secretos ni hashes de credenciales en este documento.
