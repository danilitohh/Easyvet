# Seguridad y dependencias del stack

## Alcance

Checkpoint 2.6, Fases 3B–5D y fundación clínica 6B.1 (septiembre de 2026). Se
revisó el stack base antes de incorporar autenticación, Owners/Patients, Agenda
y el schema clínico. No se añadieron uploads ni endpoints clínicos.

## Versiones y cambios

| Área           | Antes                       | Después                                                               | Motivo                                                                    |
| -------------- | --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| NestJS runtime | 11.x                        | 12.0.3 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`) | Actualización coordinada mientras el backend solo expone health.          |
| NestJS config  | 4.0.2                       | 12.0.0                                                                | Compatibilidad con NestJS 12.                                             |
| NestJS tooling | CLI/schematics/testing 11.x | 12.0.3                                                                | Versiones oficiales alineadas.                                            |
| TypeScript     | 5.9.2                       | 6.0.3                                                                 | `@nestjs/schematics@12` requiere TypeScript 6.                            |
| Prisma         | 6.19.3 instalado            | 6.19.3                                                                | Se conserva la misma major; no se aplicó el downgrade sugerido por audit. |
| Prisma CLI     | `dependencies`              | `devDependencies`                                                     | Es tooling; `@prisma/client` permanece en runtime.                        |
| Password hash  | No implementado             | `argon2@0.44.0` en API runtime                                        | Argon2id explícito para login y sesiones de Fase 3B.                      |
| Jest           | 29.7.0                      | 30.5.2                                                                | Runner compatible con la configuración ESM requerida por NestJS 12.       |
| Vitest         | 3.2.7                       | 3.2.7                                                                 | Se mantiene; la corrección disponible exige Vitest 5 (major).             |
| Luxon          | No usado                    | 3.7.x en API runtime                                                  | Conversión DST segura para horas civiles de AvailabilityRule.             |

NestJS 12 mantiene la aplicación CommonJS sobre el Node actual. Para los tests
se añadió una configuración ESM acotada (`apps/api/tsconfig.test.json` y
`jest.config.cjs`); no se modificó el código de la API.

## Auditoría antes y después

| Paquete                                      | Antes                                                                  | Después                                            | Severidad restante              | Runtime/Dev        | Acción                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| NestJS / `multer` transitivo                 | 9 vulnerabilidades totales; incluía 4 avisos altos asociados a uploads | Sin avisos de `multer`; Nest 12 usa `multer@2.4.0` | Ninguna conocida en este camino | Runtime transitivo | Actualización coordinada de NestJS; no se instaló `multer` directamente.                                                         |
| `prisma` → `@prisma/config` → `deepmerge-ts` | Alta                                                                   | Alta                                               | Alta                            | Dev/tooling        | Mantener Prisma 6.19.3; el fix propuesto por audit es un downgrade incompatible. Revisar cuando exista patch oficial compatible. |
| `vitest` → `@vitest/mocker`                  | Moderada                                                               | Moderada                                           | Moderada                        | Dev/tooling        | Mantener Vitest 3.2.7; el fix requiere Vitest 5 y no es necesario para el runtime actual.                                        |

El resultado de `npm audit` en el cierre de Fase 6B.1 es **5 vulnerabilidades: 2
moderadas y 3 altas**. Las entradas repetidas corresponden a los paquetes
afectados y sus cadenas transitivas. No se ejecutó `npm audit fix --force` ni se
aplicaron upgrades mayores.

La incorporación de `argon2@0.44.0` y `luxon@3.7.x` no añadió avisos al resultado
del audit.

## Riesgo para el runtime actual

- La vulnerabilidad de `multer` quedó resuelta al actualizar
  `@nestjs/platform-express`; Easyvet no tiene endpoints de archivos.
- Las vulnerabilidades restantes pertenecen a Prisma CLI/configuración y al
  runner Vitest, ambos tooling de desarrollo. No se observó una vulnerabilidad
  pendiente en el camino runtime de la API de health.
- PostgreSQL, Docker Compose y el schema Prisma no se modificaron.

## Criterio de seguimiento

Mantener Prisma 6.19.3 y Vitest 3.2.7 hasta disponer de una corrección patch o
minor compatible. Evaluar nuevamente antes de incorporar dominio, uploads o
ejecución de tooling en producción.
