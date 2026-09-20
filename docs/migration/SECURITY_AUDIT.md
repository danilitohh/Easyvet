# Auditoría de seguridad de Lativet

## Alcance y limitaciones

Revisión estática del commit `05fea495cb13208b27bf470b3570987fd501a81e`. Se revisaron autenticación, autorización, secretos, sesiones, datos sensibles, integraciones, RLS y exposición cliente/servidor. No se probaron endpoints contra un despliegue, no se accedió a bases, archivos de datos, correo, Google o Supabase y no se verificó configuración productiva.

No se reproducen valores secretos. En los archivos versionados revisados no se confirmó una credencial productiva; sí se encontró una clave de sesión fallback fija y múltiples ubicaciones/tipos que pueden contener secretos en ejecución.

## Controles positivos observados

- Contraseñas de usuarios hasheadas con las utilidades de Werkzeug.
- Cookies `HttpOnly` y `SameSite=Lax`; `Secure` y HTTPS activados por defecto en Vercel.
- Cabeceras CSP, HSTS bajo HTTPS, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy`.
- Comparación constante para el secreto del job.
- Tokens de firma generados criptográficamente, códigos hasheados, expiración, límite de intentos y hash de versión documental.
- Contraseña SMTP excluida de la lectura ordinaria de settings.
- `password_hash` eliminado de respuestas de usuario y contraseña en claro excluida del payload de auditoría de usuarios.
- Parámetros SQL empleados de forma predominante y allowlists para identificadores dinámicos.
- Tickets firmados y de corta duración para exportaciones de usuarios con permisos detallados.
- `.gitignore` contempla datos locales y credenciales Google.

Estos controles no compensan los hallazgos siguientes.

## Hallazgos priorizados

### SEC-01 — Crítico — La autenticación falla abierta sin credenciales administrativas

**Evidencia:** `Backend/COMPARTIDO/Rutas/web.py` considera administrador al visitante cuando no están definidos ambos valores administrativos; `Backend/COMPARTIDO/Autenticacion/rutas.py` crea una sesión administrativa en ese mismo estado.

**Impacto:** un error de configuración expone toda la API y operaciones destructivas sin autenticación.

**Acción futura:** fallar el arranque en cualquier entorno no explícitamente local; crear bootstrap administrativo de un solo uso; añadir prueba de despliegue que exija autenticación.

### SEC-02 — Alto — Clave de firma de sesión fija fuera de Vercel

**Evidencia:** `Backend/COMPARTIDO/Rutas/web.py` usa una constante de desarrollo si no existen `ADMIN_SESSION_SECRET`/`FLASK_SECRET_KEY` y no se detecta Vercel.

**Impacto:** quien conozca la constante puede falsificar cookies Flask y tickets de exportación en despliegues afectados.

**Acción futura:** exigir un secreto de alta entropía por entorno, rotarlo y separar claves de sesión y exportación. No migrar el fallback.

### SEC-03 — Alto — Perfiles de permisos heredados eluden autorización por endpoint

**Evidencia:** `Backend/ADMINISTRACION/Usuarios/permisos.py` acepta listas sin `@actions:v1`; `Backend/COMPARTIDO/Rutas/web.py` solo llama al autorizador para perfiles detallados no administradores.

**Impacto:** un usuario autenticado con perfil heredado puede invocar endpoints que la UI quizá oculte, incluidos cambios y borrados.

**Acción futura:** convertir perfiles de forma explícita y hacer que todo endpoint falle cerrado con una política server-side, independientemente de la versión de perfil.

### SEC-04 — Alto — Permiso de informes filtra colecciones clínicas y personales anidadas

**Evidencia:** `Backend/ADMINISTRACION/Usuarios/autorizacion.py` permite la colección `reports` con `reports:financial`, pero el filtro solo depura colecciones de nivel superior; `Backend/INFORMES/Clinicos/persistencia.py` incluye propietarios, pacientes, consultas, caja y auditoría dentro de `reports`.

**Impacto:** un perfil limitado a informes financieros puede recibir PII y datos clínicos para los que no tiene grants directos.

**Acción futura:** construir DTOs de informe por permiso y propósito; no incrustar colecciones crudas; agregar pruebas negativas por cada rol.

### SEC-05 — Alto — La contraseña SMTP puede duplicarse en auditoría y salir por informes

**Evidencia:** `Backend/ADMINISTRACION/Configuracion/validacion.py` acepta `smtp_app_password`; `persistencia.py` entrega todo el objeto validado a `_record_audit`; `Backend/BASE_DE_DATOS/database.py` serializa el payload sin redacción; `Backend/INFORMES/Clinicos/persistencia.py` devuelve auditoría reciente.

**Impacto:** el secreto queda duplicado en `audit_log` y puede ser leído por usuarios con acceso a informes, además de permanecer en backups.

**Acción futura:** rotar el secreto si esta ruta se usó, borrar/anonimizar copias de auditoría con procedimiento controlado, aplicar redacción central antes de persistir y separar secretos de configuración común.

### SEC-06 — Alto — Job de recordatorios público cuando falta su secreto

**Evidencia:** `Backend/COMPARTIDO/Rutas/web.py` autoriza automáticamente si `CRON_SECRET` está vacío; `Backend/SEGUIMIENTOS/rutas.py` expone un GET público con fecha y límite; `servicios.py` envía correos y devuelve nombre de paciente y correo del propietario en el resultado.

**Impacto:** un visitante puede provocar envíos, procesar fechas arbitrarias, abusar de recursos y obtener PII de resultados. El límite no tiene cota superior o inferior visible.

**Acción futura:** exigir secreto/identidad de scheduler, usar POST idempotente, limitar fecha/lote, no devolver PII y añadir rate limiting/observabilidad.

### SEC-07 — Medio — Secretos de integración se almacenan en texto claro

**Evidencia:** contraseña SMTP en `settings`; `credentials.json` y `token.json` en `Backend/AGENDA/Integracion_Google/google_calendar.py`; DSN y secretos administrativos mediante entorno.

**Impacto:** una copia de base, filesystem, log o backup comprometido expone credenciales reutilizables.

**Acción futura:** usar un gestor de secretos/KMS, cifrado por tenant para tokens OAuth, permisos mínimos y rotación. No importar archivos ni valores del legado.

### SEC-08 — Medio — Login sin protección contra intentos repetidos

**Evidencia:** `POST /api/auth/login` en `Backend/COMPARTIDO/Autenticacion/rutas.py` compara credenciales o consulta el hash sin rate limit, lockout progresivo ni registro específico de intentos.

**Impacto:** facilita fuerza bruta y credential stuffing.

**Acción futura:** rate limit por cuenta/IP, backoff, detección, auditoría sin secretos y MFA para perfiles privilegiados.

### SEC-09 — Medio — Política de contraseñas insuficiente

**Evidencia:** `Backend/ADMINISTRACION/Usuarios/validacion.py` solo exige que la contraseña nueva no esté vacía; no define longitud, lista de contraseñas comprometidas ni requisitos adicionales.

**Impacto:** permite credenciales triviales pese a utilizar un hash adecuado.

**Acción futura:** política de longitud y contraseñas comprometidas, gestor/autogeneración, recuperación segura y MFA opcional/obligatoria según rol.

### SEC-10 — Medio — Desactivación y cambio de contraseña no revocan sesiones

**Evidencia:** `Backend/ADMINISTRACION/Usuarios/persistencia.py` fuerza `is_active=True`; la cookie solo conserva `user_id` y no hay versión de sesión ni revocación al cambiar contraseña.

**Impacto:** una sesión robada continúa válida y un usuario no puede suspenderse sin borrarlo.

**Acción futura:** sesiones server-side o `session_version`, revocación global/selectiva, comprobación de estado en cada request y eventos de seguridad.

### SEC-11 — Medio — Endpoints públicos de firma carecen de cuotas y límites de payload

**Evidencia:** rutas públicas en `Backend/CONSULTORIO/Pacientes/Documentos/rutas.py`; reenvío en `servicios.py` reinicia intentos sin cooldown; la firma solo comprueba el prefijo data URL y no limita tamaño.

**Impacto:** abuso de SMTP, almacenamiento/CPU excesivo y ampliación de superficie DoS si se conoce un token válido.

**Acción futura:** límites por token/IP, cooldown y máximo de envíos, tamaño MIME/base64, decodificación y validación real de imagen, idempotencia y expiración estricta.

### SEC-12 — Medio — HTML clínico almacenado se inserta en una página pública

**Evidencia:** `Backend/CONSULTORIO/Pacientes/Documentos/servicios.py` devuelve `content_html`; `Frontend/CONSULTORIO/Pacientes/Documentos/sign.js` lo asigna a `innerHTML` sin sanitización visible.

**Impacto:** contenido manipulado por un usuario interno o importación puede alterar la página de firma, engañar al firmante y, si cambian las políticas CSP, escalar a XSS almacenado.

**Acción futura:** sanear en frontera con allowlist, versionar plantillas, renderizar en contexto aislado y mantener pruebas de payload hostil.

### SEC-13 — Medio — TLS PostgreSQL no verifica identidad por defecto

**Evidencia:** `normalize_postgres_dsn` en `Backend/BASE_DE_DATOS/contexto.py` añade `sslmode=require` cuando no existe opción.

**Impacto:** cifra el canal, pero puede no verificar estrictamente la identidad del servidor según cliente/configuración.

**Acción futura:** exigir `verify-full` y CA apropiada en producción; validar política con el proveedor administrado.

### SEC-14 — Medio — Host/proto de la petición controla URLs sensibles

**Evidencia:** `external_base_url` en `Backend/COMPARTIDO/Rutas/web.py` usa `X-Forwarded-*`/`Host`; se utiliza para callback OAuth y enlaces de firma.

**Impacto:** con proxy/hosts no restringidos, un atacante puede inducir enlaces o redirects hacia un dominio controlado.

**Acción futura:** URL pública canónica por tenant/entorno, allowlist de hosts, ProxyFix ajustado a la infraestructura y no confiar en cabeceras de cliente directo.

### SEC-15 — Medio — PII se conserva en `localStorage`

**Evidencia:** `Frontend/COMPARTIDO/Logica/interfaz.js` cachea por seis horas secciones que incluyen propietarios, pacientes, usuarios, agenda, clientes y catálogo.

**Impacto:** datos persisten después de cerrar pestañas y quedan disponibles a cualquier script del origen o a perfiles que compartan el dispositivo; la clave por id no cifra ni protege.

**Acción futura:** evitar cache persistente de PII, usar memoria/sessionStorage con mínimos datos, limpiar al logout y aplicar una política offline explícita.

### SEC-16 — Medio — Cookies seguras y HTTPS dependen del entorno

**Evidencia:** `Backend/COMPARTIDO/Rutas/web.py` habilita `SESSION_COOKIE_SECURE` y fuerza HTTPS por defecto solo bajo Vercel.

**Impacto:** un despliegue productivo distinto puede aceptar cookie por HTTP si el operador omite variables.

**Acción futura:** perfiles de configuración con fail-fast en producción y detección explícita de ambiente, no del proveedor.

### SEC-17 — Medio — Endurecimiento RLS no cubre todas las tablas actuales

**Evidencia:** `Backend/BASE_DE_DATOS/supabase/migrations/20260603160000_enable_rls_and_revoke_public_access.sql` usa una lista fija anterior a múltiples tablas actuales; el README afirma cobertura total.

**Impacto:** si roles `anon`/`authenticated` conservan grants por defecto, tablas omitidas pueden quedar expuestas mediante la API de Supabase. El estado real no se verificó.

**Acción futura:** inventario automatizado de todas las tablas del esquema, deny-by-default, RLS/grants versionados y prueba en CI/despliegue. Verificar manualmente cada instancia.

### SEC-18 — Bajo — Errores internos se devuelven al cliente

**Evidencia:** `safe_api_call` en `Backend/COMPARTIDO/Servicios/contexto.py` concatena la excepción; health/service-unavailable y algunos flujos documentales hacen lo mismo.

**Impacto:** filtra detalles de SQL, archivos, proveedores o configuración útiles para reconocimiento.

**Acción futura:** mensajes públicos estables con correlation id; detalle solo en logging estructurado y redaccionado.

## Inventario de posibles secretos — sin valores

| Archivo/ubicación                                    | Tipo                                                        | Estado observado                                   | Acción futura                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `Backend/COMPARTIDO/Rutas/web.py`                    | `ADMIN_SESSION_SECRET` / `FLASK_SECRET_KEY` y fallback fijo | Lectura de entorno; fallback versionado            | No migrar fallback; exigir, separar y rotar claves                           |
| `Backend/COMPARTIDO/Rutas/web.py`                    | `ADMIN_PASSWORD`                                            | Lectura de entorno                                 | No migrar valor; sustituir identidad compartida por usuario bootstrap seguro |
| `Backend/COMPARTIDO/Rutas/web.py`                    | `CRON_SECRET`                                               | Lectura de entorno; opcional                       | Hacer obligatorio o usar identidad de scheduler; rotar                       |
| `Backend/COMPARTIDO/Servicios/api.py`                | `DATABASE_URL`, variantes PostgreSQL                        | Lectura de entorno                                 | No registrar/importar; credenciales mínimas por entorno y rotación           |
| `.env.example`                                       | Ejemplos de DSN y secretos administrativos                  | Placeholders; no se confirmó valor productivo      | Mantener solo placeholders no sensibles                                      |
| tabla `settings`; `Configuracion/persistencia.py`    | `smtp_app_password`                                         | Texto claro y posible copia en auditoría           | Rotar, eliminar copias y mover a secret manager                              |
| `Backend/AGENDA/Integracion_Google/credentials.json` | OAuth client id/client secret                               | Ruta esperada e ignorada; archivo no inspeccionado | No importar; credenciales OAuth nuevas por entorno/aplicación                |
| `Backend/AGENDA/Integracion_Google/token.json`       | Access/refresh token OAuth                                  | Ruta esperada e ignorada; archivo no inspeccionado | No importar; revocar y reconectar por tenant cifrado                         |
| `vercel.json` y configuración de despliegue          | Referencias a variables privadas                            | No se observaron valores productivos completos     | Auditar panel e historial por separado; rotar si hubo exposición             |
| cookies Flask                                        | Cookie de sesión firmada                                    | Configurable; no es un secreto versionado          | Regenerar claves y no reutilizar cookies/sesiones del legado                 |
| tokens de firma en `document_signature_requests`     | Bearer token y hash de código                               | Datos de base no inspeccionados                    | No copiar enlaces activos; expirar y regenerar tras migración                |
| hashes en `staff_users`                              | Hashes de contraseña                                        | Datos de base no inspeccionados                    | Definir migración segura o reset obligatorio; nunca exponer                  |

## Datos sensibles tratados

- Identidad, contacto y dirección de propietarios/clientes.
- Datos de pacientes y contenido clínico completo.
- Identificación de firmantes, firma manuscrita, IP y user-agent.
- Usuarios, roles, matrículas y hashes de contraseña.
- Facturas, pagos, movimientos, cierres, préstamos y valores financieros.
- Correos, plantillas, auditoría y errores de entrega.
- Fotografías, adjuntos, PDFs/DOCX y data URLs.
- Tokens OAuth, SMTP y enlaces bearer de firma.

La futura plataforma necesita clasificación, minimización, retención, cifrado, segregación por tenant, auditoría de acceso y procedimientos de exportación/borrado. La documentación legal incluida en Lativet no sustituye revisión jurídica.

## Integraciones

### Google Calendar

El legado usa credenciales y token en archivos locales y confía en una URL externa derivada de request. Para multi-tenant se requiere OAuth web formal, state/PKCE cuando aplique, redirect canónico, token cifrado por organización/usuario, scopes mínimos, revocación y control de errores.

### SMTP

Una sola configuración global envía recordatorios, firmas, facturas y documentos. Debe decidirse si el SaaS enviará desde una identidad de plataforma o credenciales de cada clínica. En ambos casos, aislar secretos, limitar envío, gestionar rebotes y evitar PII en logs.

### Supabase/PostgreSQL

El backend usa conexión server-side; el navegador no debería tocar tablas directamente. El RLS existente pretende revocar roles cliente, pero no cubre de forma demostrable el esquema actual. En el SaaS, la defensa debe combinar filtro obligatorio por organización, constraints/índices compuestos, políticas DB verificables y pruebas de aislamiento.

## Riesgos específicos para el SaaS multi-tenant

1. No existe scoping por organización en tablas, cachés, archivos, secuencias, settings, sesiones, jobs ni integraciones.
2. Las consultas agregadas y `reports` hacen fácil omitir accidentalmente un filtro de tenant.
3. Los ids de archivo/exportación y rutas locales no contienen un límite seguro de organización.
4. Las credenciales Google/SMTP son globales y no tienen envoltura de cifrado por tenant.
5. La autorización actual mezcla rol, perfil, UI y middleware; debe centralizarse en guards/policies del backend.
6. Jobs y callbacks deben identificar organización de forma no manipulable.
7. La importación debe excluir secretos, sesiones, tokens, enlaces de firma activos y correcciones puntuales.

## Prioridad previa a cualquier migración

1. Acordar modelo de identidad/tenant y autorización fail-closed.
2. Rotar/revocar secretos si se confirma uso de los flujos vulnerables, especialmente SMTP y clave de sesión.
3. Verificar despliegue real de RLS/grants sin consultar datos de negocio.
4. Diseñar almacenamiento cifrado y segregado para archivos/tokens.
5. Crear pruebas automáticas de aislamiento tenant, control de acceso y no filtración en informes.
6. Definir plan de respuesta, logging seguro, auditoría inmutable y revocación de sesiones.
