# Arquitectura base

Las Fases 1–3B establecen un monorepo npm con un frontend React/Vite y un
backend NestJS como monolito modular. PostgreSQL es la única base prevista y
Prisma administra cambios mediante migraciones versionadas explícitas.

## Principios

- `apps/web` y `apps/api` son aplicaciones separadas con contratos TypeScript compartidos.
- `packages/contracts` contiene tipos/esquemas que cruzan la frontera HTTP,
  incluidos los dominios clínicos, documentos y consentimientos.
- `packages/config` solo expone primitivas de configuración compartidas.
- El schema Prisma mantiene las entidades core tenant/auth y los dominios
  clínicos implementados por fase; Preventive Care 6E.2 añade únicamente
  `Vaccination` y `Deworming` como satélites de `ClinicalEncounter`, y
  `ClinicalProcedure`/`ClinicalSurgeryDetail` en 6F.2A,
  `AnesthesiaRecord`/`AnesthesiaObservation` en 6F.2B,
  `DiagnosticOrder` en 6H y `ClinicalDocument`/`Consent`/`ConsentSignatureRequest`
  en 6I.
- La autenticación usa sesiones HttpOnly y entrega de correo para activación y
  recuperación de cuentas. Storage clínico local/S3-compatible y módulos
  clínicos por fase están implementados; correo operativo/SMS y otros canales
  externos siguen pendientes.
- El API no modifica el esquema al iniciar.
- Toda configuración productiva debe llegar por variables/secret manager; los defaults son exclusivamente locales.

## Capas iniciales

```text
Browser -> React Router -> services -> REST /api/v1 -> NestJS -> Prisma -> PostgreSQL
                    \-> packages/contracts <-/
```

Los límites de dominio y tenancy se decidirán antes de crear la primera entidad funcional.
