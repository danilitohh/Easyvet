# Veterinary SaaS

Base técnica independiente para una futura plataforma veterinaria SaaS multi-tenant.

Este repositorio no contiene migración de Lativet, datos reales, credenciales, integraciones ni módulos funcionales veterinarios. Lativet se mantiene únicamente como referencia documentada en `docs/migration/`.

## Stack

- Monorepo con npm workspaces.
- Frontend: React, Vite, TypeScript strict y React Router.
- Backend: Node.js, NestJS, TypeScript strict y API REST bajo `/api/v1`.
- Persistencia: PostgreSQL local mediante Docker Compose y Prisma.
- Contratos: paquete TypeScript compartido con Zod.
- Calidad: ESLint, Prettier, Vitest/React Testing Library y Jest/Supertest.

## Requisitos

- Node.js 20.19 o superior.
- npm 10 o superior.
- Docker Desktop si se desea levantar PostgreSQL local.

## Instalación

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:validate
```

Los valores de `.env.example` son exclusivamente locales. No sustituyen secretos de producción.

## Desarrollo

Levantar PostgreSQL:

```bash
docker compose up -d
```

La migración inicial del dominio multi-tenant crea `Organization`,
`ClinicLocation`, `User` y `Membership`. Aplicarla en el PostgreSQL local de
desarrollo de forma explícita:

```bash
npm run db:migrate
npm run db:seed
```

El seed es ficticio e idempotente. Sus usuarios usan una contraseña local demo
(`EASYVET_DEMO_PASSWORD`, por defecto `EasyvetDemo!2026`); la base solo recibe
hashes Argon2id. Nunca reutilizarla en producción.

`npm run db:reset` es DESTRUCTIVO y queda reservado exclusivamente para
desarrollo local.

Iniciar aplicaciones por separado:

```bash
npm run dev:web
npm run dev:api
```

O iniciar ambas:

```bash
npm run dev
```

La web queda en `http://localhost:5173`; el API en `http://localhost:3000`.

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run test:all
npm run build
```

`npm run test:db` ejecuta las pruebas de autenticación y modelo contra la base
aislada `easyvet_test`; requiere PostgreSQL local y no debe apuntar a una base
compartida. `npm run test:all` combina las pruebas normales con esa suite.

El endpoint técnico es `GET http://localhost:3000/api/v1/health` y responde un contrato `{ "status": "ok" }`.

## Estructura

```text
apps/web       React + Vite
apps/api       NestJS REST
packages/contracts  contratos compartidos
packages/config     esquemas de configuración compartida
prisma          schema multi-tenant y migraciones versionadas
docs/architecture decisiones técnicas de base
docs/migration documentación de la auditoría legacy
```

Owners y Patients ya tienen modelo, API tenant-safe y pruebas de backend desde
Fase 4A; sus pantallas funcionales siguen pendientes junto con agenda, clínica,
inventario, facturación, caja, SaaS, correo y calendarios.

## Regla de migraciones

El API no crea ni altera el esquema durante el arranque. Todo cambio debe pasar por un archivo de migración Prisma aplicado explícitamente en el entorno correspondiente.

## Fase actual

La Fase 4A deja disponibles el modelo multi-tenant, sesiones, autenticación,
autorización/aislamiento y el backend de Owners/Patients según
[MIGRATION_STATUS.md](MIGRATION_STATUS.md). El dominio veterinario restante y
las pantallas funcionales de Owners/Patients permanecen pendientes de Fase 4B.

Para revisar el shell visual:

```bash
npm run dev:web
```

Abre `http://localhost:5173/login`. Las rutas de módulos muestran placeholders y
los datos del dashboard siguen siendo ficticios; no existe todavía conexión a
datos clínicos ni motor de permisos.
