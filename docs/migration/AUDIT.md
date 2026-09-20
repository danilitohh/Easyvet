# Auditoría de Lativet — Fase 0

## Alcance y método

Esta auditoría describe el repositorio `danilitohh/Lativet` en el commit `05fea495cb13208b27bf470b3570987fd501a81e` (18 de septiembre de 2026). El análisis fue estático y local: código, configuración, migraciones y pruebas. No se conectó a SQLite, PostgreSQL, Supabase, Google ni SMTP; no se ejecutaron migraciones; no se inspeccionaron datos productivos y no se modificó el repositorio de referencia.

## Resumen ejecutivo

Lativet es una aplicación web monolítica, orientada a una sola clínica, con una cobertura funcional considerable: operación clínica, agenda, documentos y firmas, peluquería, ventas, inventario, caja, cierres e informes. Aunque el árbol fuente está dividido por dominios, la aplicación conserva acoplamientos importantes:

- el frontend se entrega como una SPA de HTML/CSS/JavaScript clásico ensamblada en tres artefactos versionados;
- el backend Flask registra todas las rutas en una única aplicación y expone una fachada de servicio y otra de persistencia;
- el estado clínico, financiero, documental y operativo comparte una sola base de datos y varias operaciones cruzan módulos dentro de la misma transacción;
- SQLite y PostgreSQL se soportan mediante una capa de compatibilidad propia, no mediante un ORM;
- el arranque puede crear o alterar esquema y ejecutar rutinas de datos de una sola vez;
- el sistema de permisos moderno es granular, pero coexiste con perfiles heredados que no pasan por esas comprobaciones.

La reimplementación futura no debe tratar Lativet como un conjunto de CRUD independientes. Facturación, inventario, caja, historia clínica, seguimientos, agenda y firmas contienen invariantes cruzadas que deben formalizarse antes de diseñar el SaaS multi-tenant.

## Tecnologías actuales

| Capa | Tecnología encontrada | Observaciones |
|---|---|---|
| Frontend | HTML, CSS y JavaScript sin framework | Fuentes modulares; salida ensamblada en `Frontend/public/` |
| Backend | Python 3, Flask 3.x | Aplicación WSGI con fábrica en `Backend/COMPARTIDO/Rutas/web.py` |
| Base local | SQLite | FK activas, WAL, `busy_timeout`, backups a archivo |
| Base remota | PostgreSQL mediante `psycopg` | Adaptador propio; selección por variables de entorno |
| Plataforma documentada | Supabase Postgres | Migraciones SQL manuales y endurecimiento RLS parcial |
| Documentos | ReportLab, Pillow y generación DOCX propia | PDFs, fórmulas, consentimientos, historias, informes y otros comprobantes |
| Integraciones | Google Calendar OAuth, SMTP | Credenciales/tokens en archivos para Google; secreto SMTP en configuración |
| Entrega | Vercel y ejecución Flask local | `vercel.json`, directorio temporal para serverless, PWA |
| Pruebas | pytest/unittest y Node test runner | 25 archivos Python de prueba; pruebas frontend y verificadores de build |

Dependencias declaradas: Flask, psycopg, clientes OAuth/Calendar de Google, ReportLab y Pillow. No hay React, TypeScript, NestJS, Prisma ni Zod en el sistema actual.

## Estructura y arquitectura

### Backend

La fábrica `create_app` de `Backend/COMPARTIDO/Rutas/web.py` configura Flask, cookies, HTTPS, cabeceras, autenticación y el registro de rutas. `Backend/COMPARTIDO/Servicios/api.py` contiene `LativetService`, fachada que enlaza funciones de servicios de los módulos. `Backend/BASE_DE_DATOS/database.py` hace lo mismo para `Database`/`PostgresDatabase`, manteniendo una conexión y el contexto transaccional compartido.

El patrón predominante por módulo es:

1. `rutas.py`: transporte HTTP;
2. `servicios.py`: orquestación de casos de uso e integraciones;
3. `validacion.py`: normalización y reglas de entrada;
4. `persistencia.py`: SQL y transacciones;
5. archivos auxiliares para exportación o reglas especializadas.

La separación existe en archivos, pero no en despliegues ni límites de datos: es un monolito modular con una base compartida. La fachada central y varias consultas agregadas generan dependencias horizontales. El endpoint de bootstrap puede reunir prácticamente todo el dominio.

### Frontend

Las fuentes están repartidas por módulos bajo `Frontend/`. `scripts/module_manifest.json` define un orden estricto y `scripts/build_project.py` ensambla los artefactos de `Frontend/public/`:

| Artefacto generado | Bloques | Fuentes | Tamaño aproximado | Líneas aproximadas |
|---|---:|---:|---:|---:|
| `app.js` | 532 | 33 JS | 2,33 MB | 58.377 |
| `styles.css` | 328 | 29 CSS | 747 KB | 32.182 |
| `index.html` | 31 | 19 HTML | 285 KB | 4.775 |

Los scripts comparten ámbito global; el orden del manifiesto es parte del comportamiento. La navegación principal cambia secciones mediante estado y manipulación del DOM, pero el servidor solo publica `/` para la aplicación. Las vistas principales no tienen rutas URL semánticas independientes. La excepción funcional es la página pública `/firmar/<token>`.

El frontend consume una API REST propia y carga datos mediante `/api/bootstrap`, con secciones solicitables. Parte del bootstrap —incluidos propietarios, pacientes, usuarios, agenda y catálogos— se conserva en `localStorage` durante seis horas. También hay `sessionStorage`, `BroadcastChannel` y eventos de almacenamiento para sesión visual, sincronización entre pestañas y firmas.

### Volumen observado

- Backend de producción: 158 archivos Python y aproximadamente 31.072 líneas.
- Pruebas backend: 25 archivos Python, aproximadamente 13.061 líneas y 353 métodos `test_*`.
- Fuentes frontend: 86 archivos HTML/CSS/JS y aproximadamente 90.735 líneas.
- Rutas HTTP declaradas: alrededor de 126 decoradores de ruta, incluyendo API y estáticos.

Estas métricas describen superficie, no calidad, y explican por qué una sustitución total requiere contratos y pruebas de caracterización antes de migrar.

## Datos y persistencia

`LativetService` selecciona PostgreSQL si encuentra `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL` o `POSTGRES_URL_NON_POOLING`; en caso contrario usa SQLite. En Vercel se rechaza explícitamente el fallback SQLite. La compatibilidad PostgreSQL se implementa transformando SQL y placeholders desde la capa propia.

La aplicación administra el esquema al iniciar. Además de crear tablas e índices, ejecuta backfills y rutinas marcadas como “one time”. Una de ellas puede respaldar y vaciar datos de inventario/facturación cuando falta su marcador; luego restaura solamente el catálogo. Ese comportamiento es específico de la evolución de esta instalación y no debe trasladarse a un SaaS.

SQLite dispone de backup local con timestamp. El backend declara que el backup desde aplicación no está soportado para PostgreSQL. Los directorios de datos se ignoran en Git. No se encontraron datasets reales versionados ni seeds de propietarios/pacientes; sí hay configuración predeterminada y categorías de catálogo iniciales.

El detalle de tablas, relaciones, índices y migraciones está en `DATA_MODEL_LEGACY.md`.

## Integraciones y archivos

### Google Calendar

La agenda puede conectarse a Google Calendar, consultar ocupación y sincronizar asistencia. El código conserva `credentials.json` y `token.json` en el directorio de integración. El README reconoce que parte del flujo heredado es de aplicación instalada; el código web actual también expone callback. El modelo de credenciales, redirect URIs, almacenamiento de tokens y aislamiento por clínica necesita una decisión nueva.

### Correo SMTP

SMTP se usa en recordatorios, facturación, documentos, consentimientos y seguimientos. La contraseña se guarda como un valor de `settings`, aunque se oculta al leer configuración normal. El guardado de configuración audita el payload completo, lo que puede duplicar el secreto en `audit_log`.

### Documentos y storage

Se generan PDFs, DOCX y otros artefactos en subdirectorios locales de `data/exports/`: consentimientos, documentos clínicos, fórmulas, facturación, pagos, informes, inventario, historias y remisiones. Las firmas y algunos adjuntos se guardan además como `data:`/base64 o JSON en la base. En serverless, los archivos locales son efímeros. La futura interfaz `StorageService` deberá cubrir generación, persistencia, descarga autorizada, expiración y eliminación; no solo reemplazar rutas de disco.

## Autenticación y autorización

Hay dos identidades administrativas:

- administrador por variables `ADMIN_EMAIL`/`ADMIN_PASSWORD`;
- usuarios de `staff_users` con contraseña hasheada mediante Werkzeug.

La sesión es una cookie firmada de Flask con `HttpOnly`, `SameSite=Lax`, duración permanente de 30 días cuando se solicita recordar y `Secure` solo por defecto en Vercel. Si las credenciales de administrador no están configuradas, la aplicación considera que no hace falta iniciar sesión y concede privilegios de administrador. Fuera de Vercel existe una clave de sesión fija de desarrollo como fallback.

Los permisos nuevos usan el marcador `@actions:v1` y grants por recurso/acción. La autorización detallada solo se ejecuta para esos perfiles; listas heredadas sin el marcador mantienen su contrato anterior y, en la práctica, el middleware no les impone controles por endpoint. El campo `is_active` existe, pero lectura y autenticación lo fuerzan a `true`.

## Dependencias críticas entre módulos

- Facturación → inventario: una factura descuenta existencias; una cotización no.
- Facturación → caja: facturas/pagos crean movimientos automáticos; borrar o editar revierte y reconstruye efectos.
- Caja/Compras/Facturación → cierres: una mutación posterior invalida cierres mensuales afectados.
- Consulta → historia: toda consulta pertenece a una historia; una consulta estándar inicial puede sincronizar el resumen de la historia.
- Consulta → paciente: peso, vacunación y desparasitación actualizan el perfil longitudinal.
- Consulta → agenda/seguimientos: puede crear cita de control, recordatorios y series de seguimiento.
- Peluquería → documentos clínicos: el consentimiento se materializa como una consulta/documento clínico sintético y una solicitud de firma.
- Firma → documento: el hash vincula la firma a una versión; la evidencia vuelve al JSON de la consulta.
- Propietario/paciente → casi todo el dominio: los borrados son cascadas manuales amplias.
- Permisos → bootstrap/exportaciones: el filtro de colecciones y los tickets firmados condicionan los datos y archivos visibles.

## Estado de rutas y navegación

La API usa rutas claras por recurso, pero el frontend no refleja cada módulo en la URL. Para el futuro producto se deben diseñar rutas como `/agenda`, `/pacientes/:id`, `/ventas/facturas` o equivalentes; no se deben inferir automáticamente del estado interno actual. Ese diseño pertenece a una fase posterior.

## Conclusiones

1. Lativet ya es funcionalmente amplio y contiene reglas que no están concentradas en un único lugar; muchas viven entre validación, servicio, persistencia y frontend.
2. La unidad correcta de análisis no es cada pantalla, sino cada operación transaccional y su impacto en otros dominios.
3. El modelo actual es single-tenant: ninguna tabla de negocio posee `tenant_id`/`organization_id`; los archivos, caches, secuencias, usuarios, configuración y credenciales también son globales.
4. Existen riesgos de seguridad que deben resolverse antes de reutilizar patrones actuales, especialmente el modo sin autenticación, permisos heredados, exposición por informes, secreto de sesión fijo y endpoints públicos de trabajo/firma.
5. La doble compatibilidad SQLite/PostgreSQL, el esquema autorreparable y las rutinas “one time” son deuda de transición, no requisitos del nuevo producto.
6. La reimplementación debe partir de contratos documentados, decisiones humanas pendientes y pruebas de comportamiento; no de una traducción línea por línea.

## Límites y asuntos no confirmados

- No se verificó el estado real de RLS, grants, constraints o migraciones en ninguna instancia Supabase.
- No se comprobó qué variables se encuentran configuradas en despliegues reales.
- No se inspeccionaron bases SQLite, buckets, archivos generados ni credenciales fuera de Git.
- El código permite estados y flujos heredados cuya utilización real requiere validación con personal de la clínica.
- La exactitud legal/fiscal de plantillas, retención, numeración y documentos debe validarse por expertos del dominio antes del diseño SaaS.
