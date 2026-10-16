# Seguridad y dependencias del stack

## Revisión vigente

Actualizado el 16 de octubre de 2026 contra el lockfile del monorepo. Los
resultados describen advisories conocidos por npm para ese árbol; no sustituyen
la revisión de licencias, procedencia ni una prueba dinámica de alcanzabilidad.

| Área                | Versión resuelta                                                            | Alcance                           |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| NestJS runtime      | `@nestjs/common`, `core`, `platform-express` 11.2.7; `@nestjs/config` 4.0.4 | API                               |
| TypeScript          | 6.0.3                                                                       | Build y tipos del monorepo        |
| Prisma              | CLI y client 6.19.3                                                         | CLI en tooling; client en API     |
| Hash de contraseñas | `argon2@0.44.0`                                                             | API runtime; Argon2id             |
| Jest / ts-jest      | 30.5.2 / 29.4.15                                                            | Pruebas de API                    |
| Vitest              | 5.0.5                                                                       | Pruebas de web                    |
| Supabase JS         | 2.118.0 en el workspace API                                                 | Integración server-side           |
| Luxon               | 3.7.2                                                                       | API runtime; fechas civiles y DST |

## Resultados de `npm audit`

| Comando (16 oct 2026)                         | Resultado             | Interpretación                                                                       |
| --------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `npm audit --omit=dev --audit-level=moderate` | 0 vulnerabilidades    | npm no reportó advisories en las dependencias de producción del lockfile.            |
| `npm audit --audit-level=moderate`            | 20 entradas moderadas | Son rutas transitivas repetidas de un solo advisory, no veinte advisories distintos. |

La cadena afectada está en tooling de pruebas:
`ts-jest@29.4.15` → `@jest/transform@30.5.2` → `babel-plugin-istanbul` →
`@istanbuljs/load-nyc-config` → `js-yaml@3.15.2` → `argparse@1.0.10` →
`sprintf-js@1.0.3`.

El [advisory GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
afecta `sprintf-js` hasta 1.1.3 inclusive y no lista versión corregida al
momento de la revisión. npm propone downgrades incompatibles de Jest/ts-jest;
no se ejecutó `npm audit fix --force` ni se agregó un override para ocultar la
alerta. No se encontró una ruta desde una petición del API al código afectado;
esto es una evaluación estática, no una demostración de seguridad dinámica.

## Estado de la instalación local

`npm ls --depth=0` detectó que el `node_modules` presente no coincide por
completo con los manifiestos: entre otros, la copia raíz de
`@supabase/supabase-js` era 2.117.3 aunque el rango declarado es `^2.118.0`, y
había paquetes extraneous. Esto no demuestra un problema del lockfile ni del
deployment, pero sí significa que las pruebas locales que dependan de esa copia
no validan exactamente una instalación limpia. La configuración de Vercel usa
`npm ci`; para una verificación reproducible local, preparar una instalación
limpia en un worktree/checkout aislado antes de reemplazar dependencias locales.

## Seguimiento

- Repetir ambos comandos de `npm audit` al cambiar paquetes y antes de release.
- Mantener tooling de pruebas fuera de rutas que procesen contenido no confiable.
- Revisar de nuevo el advisory cuando exista una versión corregida o cambie la
  cadena transitiva; no forzar downgrades incompatibles.
- Revisar licencias, procedencia y mantenimiento de dependencias por separado:
  `npm audit` no certifica esos aspectos.
