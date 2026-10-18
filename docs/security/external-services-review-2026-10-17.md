# Easyvet — revisión de servicios y SDK externos (2026-10-17)

Esta revisión inventaría los servicios externos declarados en el código y el
flujo de datos observable en el checkout. No sustituye la revisión contractual,
de privacidad o de licencias que debe repetirse cuando cambien los proveedores,
las versiones o el tratamiento de datos.

## Inventario y límites

| Servicio/SDK         | Uso                                                            | Datos que recibe                                                                                    | Controles actuales                                                                                                         |
| -------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Supabase JS          | Realtime en el navegador y Storage desde el backend            | El navegador usa URL y clave pública; el backend envía metadatos y archivos al proyecto configurado | RLS/tenant en base de datos, clave de servicio solo en servidor, bucket privado y suscripciones Realtime por organización  |
| Vercel Web Analytics | Analítica opcional de navegación                               | Rutas sanitizadas, sin query/hash; se descartan rutas públicas de firma                             | Montaje únicamente tras consentimiento explícito y `beforeSend` en `apps/web/src/services/analytics.ts`                    |
| Vercel               | Hosting, funciones y despliegues                               | Solicitudes de la aplicación y logs operativos del runtime                                          | Headers de seguridad, `request-id`, redacción de errores y revisión de logs sin credenciales                               |
| Resend               | Entrega de verificación de correo y recuperación de contraseña | Correo destinatario, asunto y enlaces de acción con expiración                                      | Integración HTTP server-side sin SDK, `RESEND_API_KEY` solo en entorno, enlaces ausentes de logs y contenido HTML escapado |
| AWS S3 SDK           | Adaptador de Storage alternativo del backend                   | Objetos y metadatos solo cuando se selecciona ese proveedor                                         | Código de servidor, credenciales por entorno y pruebas del adaptador; no se expone al cliente                              |
| FullCalendar         | Calendario de agenda en el navegador                           | Eventos ya autorizados por la API                                                                   | La API filtra por organización; la librería solo materializa la vista                                                      |
| HeroUI y estilos     | Componentes y estilos de interfaz                              | Ningún dato de negocio por sí mismos                                                                | Dependencias empaquetadas; no se cargan iframes ni scripts de terceros para los controles                                  |
| Manrope              | Tipografía distribuida como paquete                            | Ninguno                                                                                             | Archivos incluidos en el build, sin fuente remota en runtime                                                               |
| PDFKit               | Generación de documentos en la API                             | Datos necesarios para el documento solicitado                                                       | Ejecución server-side y respuesta limitada al recurso autorizado                                                           |

React Bits y Kokonut UI se usan como referencia/patrones visuales; no hay una
dependencia de runtime ni un iframe de esos sitios en la aplicación.

## Evidencia de implementación

- `apps/web/src/app/App.tsx` monta Vercel Analytics solo cuando la aplicación
  está en producción y la preferencia es `granted`.
- `apps/web/src/services/analytics.ts` elimina query strings, fragmentos,
  identificadores UUID y rutas públicas de firma.
- `apps/web/src/contexts/RealtimeContext.tsx` crea el cliente Realtime de
  forma diferida y usa la URL y clave pública del entorno del navegador.
- `apps/api/src/storage/supabase-storage.adapter.ts` y
  `apps/api/src/storage/s3-storage.adapter.ts` mantienen Storage en el
  servidor; las pruebas de documentos protegen la ausencia de `storageKey` en
  respuestas públicas.
- `apps/web/src/contexts/RealtimeContext.test.tsx`,
  `apps/web/src/services/analytics.test.ts` y las pruebas de documentos cubren
  los límites principales de estos flujos.

## Licencias y revisión continua

La inspección de metadatos instalados del 2026-10-17 observó, entre otros,
Supabase JS/HeroUI/FullCalendar/Argon2 bajo MIT, AWS SDK y Prisma bajo
Apache-2.0 y Manrope bajo OFL-1.1. La licencia de cada versión transitive debe
seguir revisándose desde `package-lock.json` y los metadatos del paquete antes
de una distribución comercial. No se incorporan recursos visuales externos
sin revisar sus derechos de uso.

## Pendientes que no se deben asumir

- confirmar con cada proveedor la región, retención, subprocesadores y
  transferencia internacional aplicables al plan contratado;
- revisar cambios de licencia y versiones en cada actualización de
  dependencias;
- configurar y verificar métricas/alertas de Vercel o del proveedor elegido;
- confirmar si el adaptador S3 seguirá siendo necesario en producción o debe
  retirarse para reducir superficie operativa.

La verificación operativa del 2026-10-18 confirmó que el proyecto Supabase
está `ACTIVE_HEALTHY` y sin lints de seguridad. En Vercel, la cuenta correcta
`danilitohhhh@gmail.com` y el equipo `danilo-258d` exponen el proyecto `easyvet`
con deployment `READY`, pero el plan Hobby no permite eventos personalizados,
Observability Plus no está habilitado y no hay log drains. Retención y alertas
siguen pendientes de configuración y verificación.
