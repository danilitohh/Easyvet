# Easyvet — evidencia de Supabase Advisors (2026-10-17)

Esta nota registra consultas de solo lectura en el proyecto de producción
`supabase-champagne-ball`, mediante el conector autorizado. La última
observación se obtuvo el 2026-10-17 a las 19:03 COT
(2026-10-18T00:03:44Z). No se ejecutaron
migraciones, concesiones, cambios de políticas ni acciones destructivas del
panel.

## Resultado observado

- **Security Advisor:** 0 lints reportados por la consulta del conector.
- **Performance Advisor:** 137 claves foráneas sin índice de cobertura, 48
  advertencias **Auth RLS Initialization Plan** y 94 índices sin uso observado.
- Las advertencias de RLS señalan políticas de tablas públicas que usan
  `current_setting()` o funciones de autenticación en expresiones RLS que
  podrían reevaluarse por fila. Los avisos de índices son señales para medir,
  no instrucciones para crear o eliminar índices en bloque.
- Referencias oficiales: [claves foráneas sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [RLS initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) e [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- La consulta de metadatos de solo lectura del conector, observada el
  2026-10-17, reportó 49 relaciones públicas: 48 con RLS habilitado, 48 con
  RLS forzado y 0 lecturas directas para los roles `anon` y `authenticated`.
  La relación adicional es `public._prisma_migrations`, usada por Prisma y
  separada de las tablas de aplicación.

## Decisión operativa

No se aplican cambios automáticos por este aviso. La corrección potencial
implica revisar las expresiones de las políticas, comparar planes de ejecución
con datos representativos y preparar una migración reversible con ventana de
observación. No se deben envolver o reemplazar las expresiones RLS en bloque
sin confirmar que el contexto transaccional de Easyvet conserva exactamente el
mismo aislamiento por organización.

## Siguiente evidencia requerida

Antes de crear una migración, hace falta:

1. identificar las políticas concretas afectadas y su expresión completa;
2. medir consultas representativas con el contexto `tenant` y `system`;
3. comparar la variante optimizada con la actual en una base efímera;
4. revisar rollback y compatibilidad con Realtime;
5. aprobar explícitamente una ventana para aplicar la migración al proyecto
   productivo.

El resultado no se interpreta como una vulnerabilidad ni como autorización para
modificar producción. Los avisos de rendimiento quedan pendientes con su
alcance y evidencia delimitados.

## Intento de benchmark read-only

Se abrió un SQL Editor temporal y se intentó ejecutar, dentro de una
transacción con `ROLLBACK`, un `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` sobre
`public.owners` con un contexto `tenant` sintético y un identificador de
organización inexistente. El benchmark no es válido porque la conexión del
editor no puede asumir los roles de runtime ni tiene permisos equivalentes:

- `SET LOCAL ROLE veterinary` fue rechazado con `permission denied to set role`.
- `SET LOCAL ROLE authenticated` llegó a la consulta, pero fue rechazado con
  `permission denied for schema public`.

No se concedieron permisos, no se modificaron políticas y no se expusieron
filas clínicas. Por tanto, no se reporta un tiempo de ejecución ni se afirma
que el aviso tenga un impacto medido. Para comparar la política actual con una
variante optimizada todavía hace falta una base efímera o una conexión de
pruebas con permisos controlados y datos sintéticos representativos.
