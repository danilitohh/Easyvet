# Easyvet V1

Easyvet es una plataforma web multi-tenant para la operación de clínicas veterinarias. La V1 reúne agenda, expediente clínico, servicios veterinarios, inventario, operación comercial y administración en un monolito modular.

## Arquitectura

- Web: React, Vite, TypeScript y React Router (`apps/web`).
- API: NestJS, TypeScript y REST bajo `/api/v1` (`apps/api`).
- Persistencia: PostgreSQL 16 y Prisma; el esquema se crea únicamente con migraciones versionadas.
- Contratos compartidos: Zod y TypeScript (`packages/contracts`).
- Almacenamiento de documentos: adaptadores local y S3-compatible.

El límite de tenant es `Organization`. `User` es identidad global; `Membership` define acceso, rol y permisos en una organización. Consulte [la arquitectura V1](docs/architecture/v1-overview.md).

## Requisitos

- Node.js 20.19 o posterior y npm 10 o posterior.
- Docker Desktop con Docker Compose para PostgreSQL local.

## Instalación local

En PowerShell:

```powershell
npm install
Copy-Item .env.example .env
```

En macOS/Linux, use `cp .env.example .env` en lugar de `Copy-Item`. Revise `.env` y mantenga `DATABASE_URL` exclusivamente en `easyvet_dev`, y `DATABASE_URL_TEST` en `easyvet_test`. Reemplace el valor de ejemplo de `EASYVET_DEMO_PASSWORD` por una contraseña local única antes de sembrar. El seed no tiene una contraseña predeterminada y se niega a ejecutarse con `NODE_ENV=production`.

El modo `mock` es solo para desarrollo/pruebas aisladas; la configuración fuerza el modo API en builds de producción para evitar datos ficticios en la aplicación desplegada.

Inicie PostgreSQL y prepare el esquema local:

```bash
docker compose up -d
docker compose ps
npm run prisma:generate
npm run prisma:validate
npm run db:migrate
npm run db:seed
```

El seed crea datos ficticios e idempotentes. No reutilice estos datos ni secretos locales en un entorno compartido o productivo. `npm run db:reset` es destructivo; no lo ejecute contra `easyvet_dev`.

## Desarrollo y ejecución

Inicie web y API juntas:

```bash
npm run dev
```

La web está en `http://localhost:5173`; la API, en `http://localhost:3000`. El endpoint de salud es `GET http://localhost:3000/api/v1/health`.

Para probar el artefacto compilado de la API localmente:

```bash
npm run build
npm run start:api:prod
```

El comando inicia `apps/api/dist/src/main.js` usando las variables locales actuales; es un smoke de build/start, no un despliegue ni una configuración productiva completa. El frontend se genera en `apps/web/dist` durante el build.

Detenga los servidores con `Ctrl+C`. Para detener PostgreSQL, use `docker compose stop`.

## Validaciones

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:all
npm run build
npm run prisma:generate
npm run prisma:validate
```

`npm run test:db` utiliza la base local aislada `easyvet_test`; el script fija esa URL de pruebas. No cambie ese comando para apuntar a `easyvet_dev` ni a bases reales. `npm run test:all` ejecuta las suites normales y luego las pruebas con PostgreSQL.

## Módulos V1

La aplicación cubre multi-tenancy, autenticación y permisos; propietarios y pacientes; agenda y disponibilidad; historia y operaciones clínicas (encuentros, evoluciones, prescripciones, cuidados preventivos, procedimientos, anestesia, hospitalización, diagnósticos y documentos/consentimientos); seguimientos; peluquería; inventario; ventas, facturación interna y caja; usuarios, configuración e informes. La matriz de rutas y alcance está en [readiness V1](docs/release/v1-readiness.md).

## Límites conocidos

V1 no incluye integraciones de email/SMS/push o calendarios, laboratorios externos, facturación electrónica/fiscal, pasarela de pagos, compras/proveedores, aplicación móvil nativa ni exportación avanzada de informes. El adaptador S3 está disponible pero no tuvo una integración remota live-test en este cierre. Consulte [limitaciones V1](docs/release/v1-known-limitations.md) y [QA de cierre](docs/qa/v1-closure.md).

## Seguridad de datos

Use exclusivamente bases locales dedicadas `easyvet_dev` y `easyvet_test` para desarrollo y pruebas. Nunca copie datos reales de propietarios, pacientes, historias clínicas o finanzas al seed o a QA. No incluya `.env`, contraseñas, tokens ni archivos de documentos en Git. El estado de seguridad y los avisos de dependencias están en [revisión de seguridad V1](docs/security/v1-security-review.md).
