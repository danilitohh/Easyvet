# Arquitectura base

La Fase 1 establece un monorepo npm con un frontend React/Vite y un backend NestJS como monolito modular. PostgreSQL es la única base prevista y Prisma administra cambios mediante migraciones versionadas explícitas.

## Principios

- `apps/web` y `apps/api` son aplicaciones separadas con contratos TypeScript compartidos.
- `packages/contracts` contiene tipos/esquemas que cruzan la frontera HTTP; no contiene dominio veterinario todavía.
- `packages/config` solo expone primitivas de configuración compartidas.
- No se implementan todavía `Organization`, `Membership`, autenticación completa, storage, correo, calendarios ni módulos clínicos.
- El API no modifica el esquema al iniciar.
- Toda configuración productiva debe llegar por variables/secret manager; los defaults son exclusivamente locales.

## Capas iniciales

```text
Browser -> React Router -> services -> REST /api/v1 -> NestJS -> Prisma -> PostgreSQL
                    \-> packages/contracts <-/
```

Los límites de dominio y tenancy se decidirán antes de crear la primera entidad funcional.
