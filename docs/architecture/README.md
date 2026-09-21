# Arquitectura base

Las Fases 1–3B establecen un monorepo npm con un frontend React/Vite y un
backend NestJS como monolito modular. PostgreSQL es la única base prevista y
Prisma administra cambios mediante migraciones versionadas explícitas.

## Principios

- `apps/web` y `apps/api` son aplicaciones separadas con contratos TypeScript compartidos.
- `packages/contracts` contiene tipos/esquemas que cruzan la frontera HTTP,
  incluidos los contratos clínicos y de Preventive Care ya implementados.
- `packages/config` solo expone primitivas de configuración compartidas.
- El schema Prisma mantiene las entidades core tenant/auth y los dominios
  clínicos implementados por fase; Preventive Care 6E.2 añade únicamente
  `Vaccination` y `Deworming` como satélites de `ClinicalEncounter`.
- La autenticación de Fase 3B usa sesiones HttpOnly. Storage, correo, calendarios,
  permisos completos y módulos clínicos permanecen pendientes.
- El API no modifica el esquema al iniciar.
- Toda configuración productiva debe llegar por variables/secret manager; los defaults son exclusivamente locales.

## Capas iniciales

```text
Browser -> React Router -> services -> REST /api/v1 -> NestJS -> Prisma -> PostgreSQL
                    \-> packages/contracts <-/
```

Los límites de dominio y tenancy se decidirán antes de crear la primera entidad funcional.
