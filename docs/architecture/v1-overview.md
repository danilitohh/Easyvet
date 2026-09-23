# Easyvet V1 — arquitectura

## Forma del sistema

Easyvet es un monolito modular con dos procesos de aplicación: una SPA React/Vite y una API NestJS. Comparten tipos y contratos Zod en `packages/contracts`; la API valida y persiste las operaciones. PostgreSQL es la fuente de verdad y Prisma aporta el modelo y las migraciones versionadas. El arranque de la API no crea ni modifica el esquema.

| Parte                | Responsabilidad                                                            |
| -------------------- | -------------------------------------------------------------------------- |
| `apps/web`           | Interfaz React, rutas semánticas, navegación y estados de interacción      |
| `apps/api`           | REST `/api/v1`, autenticación, permisos, reglas de dominio y transacciones |
| `packages/contracts` | Tipos y esquemas Zod compartidos por web y API                             |
| `packages/config`    | Configuración tipada y validación fail-fast                                |
| `prisma`             | Esquema PostgreSQL, 27 migraciones y seed ficticio local                   |

## Tenant e identidad

`Organization` es la frontera de tenant; `ClinicLocation` organiza sedes. `User` representa la identidad global y no concede por sí sola acceso a una clínica. `Membership` relaciona usuario y organización, aporta el rol organizacional y, cuando aplica, el perfil clínico. La API deriva el tenant de la sesión/membresía activa y combina guards, permisos por operación, filtros por organización y relaciones/constraints compuestas. El rol de plataforma se mantiene separado de los permisos clínicos y comerciales del tenant.

La autenticación usa sesiones opacas en cookie; el token se genera aleatoriamente y PostgreSQL conserva su SHA-256, no el valor de cookie. El password se verifica/almacena mediante Argon2id. Las sesiones tienen vencimiento y revocación; cambiar contraseña conserva la sesión que realiza el cambio y revoca las otras sesiones de ese usuario.

## Dominios V1

- SaaS, organizaciones, sedes, miembros, roles y configuración.
- Owners, Patients, Agenda y disponibilidad.
- Expediente clínico, encuentros, evoluciones, prescripciones, cuidados preventivos, procedimientos/cirugía, anestesia, hospitalización y diagnósticos.
- Documentos clínicos, consentimientos, solicitudes de firma y seguimientos internos.
- Grooming, inventario con movimientos, ventas, facturas internas y caja.
- Informes operacionales, clínicos, comerciales y de inventario.

Los módulos mantienen sus responsabilidades en carpetas propias; páginas clínicas se acceden desde el contexto del Patient/Encounter, no desde enlaces globales ficticios. La web carga rutas pesadas bajo demanda y cada ruta desconocida usa una pantalla 404.

## Persistencia y archivos

Las escrituras de dominio viven en servicios de la API y utilizan transacciones, constraints SQL y control de versión (`expectedVersion`) donde el diseño lo requiere. Los historiales financieros y de stock usan movimientos compensatorios y restricciones append-only en base de datos. Las fechas civiles se transportan como fechas civiles; los timestamps se presentan con la zona horaria de la organización.

Documentos se guardan detrás de una interfaz de almacenamiento. El driver local se usa en desarrollo; existe un adaptador compatible con S3 y su configuración se valida, pero un servicio S3 remoto no fue probado durante el cierre V1. Las descargas están autenticadas y se restringen al tenant.

## Rutas principales

La SPA usa URLs directas y recargables. La lista vigente por grupos, incluidos los patrones contextuales de historia clínica, está en [readiness V1](../release/v1-readiness.md). La navegación lateral solo expone rutas globales para las que la membresía tiene permiso; otros dominios viven bajo `/pacientes/:patientId/historia/...`.

## Arranque local

`npm run dev` inicia Vite (`5173`) y Nest (`3000`). PostgreSQL local se inicia con Docker Compose. Las migraciones se aplican de forma explícita con `npm run db:migrate`; el seed exige `EASYVET_DEMO_PASSWORD`, usa identidades/datos ficticios e impide ejecución con `NODE_ENV=production`. El comando `npm run start:api:prod` ejecuta el JavaScript Nest compilado como smoke local, no como despliegue productivo.
