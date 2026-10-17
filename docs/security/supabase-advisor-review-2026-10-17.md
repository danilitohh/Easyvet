# Easyvet — revisión de asesores Supabase (2026-10-17)

## Alcance

Consulta de solo lectura mediante el proyecto Supabase conectado al despliegue de
Easyvet (`iykzaqtcewnxgrmlbinz`). No se ejecutaron migraciones, cambios de RLS,
grants, índices ni lecturas de filas clínicas.

## Estado observado

- El proyecto está activo y saludable.
- El historial visible contiene la migración `20261016013436`
  (`revoke_public_client_data_access`).
- El asesor de seguridad solo reporta un aviso informativo: `public.api_rate_limit_buckets`
  tiene RLS habilitado sin políticas. Es una tabla interna de buckets de rate limit,
  con acceso de cliente revocado; no se debe crear una política pública para silenciar
  el aviso.
- El asesor de rendimiento reporta 137 claves foráneas sin un índice de cobertura y
  varios índices sin uso observado. Estos avisos no prueban por sí mismos que cada
  índice falte: el diseño usa restricciones compuestas por organización y algunos
  índices no aparecen en una muestra corta de tráfico.

## Decisiones de seguridad

No se habilita RLS de forma masiva desde este informe. La revisión del runtime de
Easyvet confirmó que Prisma usa un rol con `rolbypassrls`, por lo que activar RLS sin
políticas compatibles no mejoraría el aislamiento de las peticiones actuales y podría
romper operaciones. El aislamiento vigente depende de guards, contexto de tenant,
permisos server-side, filtros obligatorios por `organizationId` y restricciones
compuestas.

## Siguiente trabajo aprobado antes de tocar la base

1. Definir si Supabase será también una frontera de acceso directo para clientes
   `authenticated`, o si seguirá siendo solo la base detrás de NestJS.
2. Si se decide RLS para clientes directos, diseñar políticas por tabla y probarlas
   con roles anon/authenticated y tenants ficticios en una rama o entorno aislado.
3. Para índices, seleccionar primero las consultas Easyvet con mayor latencia o
   frecuencia y comparar `EXPLAIN (ANALYZE, BUFFERS)` antes y después; no aplicar los
   137 avisos como una migración automática.

Esta evidencia no sustituye una revisión de producción ni una revisión profesional
de seguridad de infraestructura.
