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

Todavía no existe una migración inicial: el schema Prisma permanece sin entidades hasta diseñar `Organization`, `User` y `Membership`.

Cuando exista el primer modelo aprobado, crear y aplicar la migración de desarrollo de forma explícita:

```bash
npm run prisma:migrate:dev -- --name init
```

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
npm run build
```

El endpoint técnico es `GET http://localhost:3000/api/v1/health` y responde un contrato `{ "status": "ok" }`.

## Estructura

```text
apps/web       React + Vite
apps/api       NestJS REST
packages/contracts  contratos compartidos
packages/config     esquemas de configuración compartida
prisma          schema sin entidades y migraciones futuras versionadas
docs/architecture decisiones técnicas de base
docs/migration documentación de la auditoría legacy
```

No se crean todavía módulos de pacientes, propietarios, agenda, clínica, inventario, facturación, caja, SaaS, correo o calendarios.

## Regla de migraciones

El API no crea ni altera el esquema durante el arranque. Todo cambio debe pasar por un archivo de migración Prisma aplicado explícitamente en el entorno correspondiente.

## Fase actual

La Fase 1 deja preparada la infraestructura. Multi-tenancy, autenticación completa, dominio veterinario, integraciones y UI final permanecen pendientes según [MIGRATION_STATUS.md](MIGRATION_STATUS.md).
