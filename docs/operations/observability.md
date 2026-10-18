# Easyvet — diagnóstico operativo seguro

Este runbook describe la evidencia que la API deja disponible para investigar
solicitudes lentas o errores sin registrar credenciales, contenido clínico ni
identificadores innecesarios. No sustituye métricas, alertas ni un acuerdo de
retención del proveedor.

## Correlación de una solicitud

1. Copia el valor de `X-Request-Id` de la respuesta afectada.
2. Busca ese valor en los logs del proveedor de ejecución, sin pegar cookies,
   tokens, cuerpos ni URLs completas en tickets o chats.
3. Correlaciona el evento con el método, la ruta normalizada, el estado HTTP y
   la duración registrados por la API.
4. Revisa `/api/v1/health` y `/api/v1/health/ready` para separar un fallo de
   proceso de un problema de dependencias, especialmente base de datos.

## Eventos de solicitudes lentas

`RequestTelemetryMiddleware` registra una advertencia únicamente cuando la
duración alcanza `SLOW_REQUEST_LOG_MS` (por defecto, `1000` ms). El evento
contiene solo:

- `event: slow_request`;
- `requestId`, `method`, `path` normalizada, `statusCode`, `durationMs` y
  `thresholdMs`.

La ruta se obtiene de la plantilla de Express cuando está disponible. En caso
contrario, los segmentos que parecen UUID, números o identificadores largos se
reemplazan por `:param`, y se elimina cualquier query string o fragmento.
El `requestId` se toma primero del header de respuesta generado y validado por
`RequestIdMiddleware`; un header entrante inválido no se copia al log. Nunca se
registran cuerpos, cookies, headers completos, query strings, tokens, correos,
nombres de pacientes, tenant ids ni valores clínicos.

## Límites conocidos

- La implementación es diagnóstico estructurado, no un sistema de métricas,
  trazas distribuidas ni alertas de negocio.
- La retención, exportación y alertas del proveedor deben configurarse y
  verificarse en la cuenta operativa; este repositorio no inventa esos valores.
- No se deben usar logs como almacén de información clínica o credenciales.
- Los cambios de umbral deben probarse en un entorno no productivo antes de
  aplicarse a producción.

## Verificación externa 2026-10-18

Supabase respondió `ACTIVE_HEALTHY` y su Security Advisor no reportó lints de
seguridad. La cuenta Vercel correcta es `danilitohhhh@gmail.com`, equipo
`danilo-258d`, proyecto `easyvet`; el último deployment consultado está en
estado `READY`. En el periodo consultado se observaron 4 pageviews y 1
visitante. Los eventos personalizados requieren Pro o Enterprise,
Observability Plus no está habilitado y no hay log drains configurados. La
retención exacta y las alertas de Vercel siguen sin estar verificadas.
