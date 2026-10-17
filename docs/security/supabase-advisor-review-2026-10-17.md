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

El rollout de RLS por tenant ya fue aplicado mediante la migración
`20261017090000_add_tenant_rls_context`. La verificación protegida de producción
confirmó que Prisma usa el rol `veterinary` sin `rolbypassrls`; el contexto de
organización se establece por transacción y las operaciones globales de rate
limit usan scope `system`. La API continúa siendo la frontera principal y las
políticas RLS funcionan como defensa adicional.

## Siguiente trabajo, sin cambios automáticos en la base

1. Mantener Supabase como base detrás de NestJS; no se concede acceso directo de
   clientes a las tablas de aplicación.
2. Ejecutar la prueba autorizada de dos tenants con datos sintéticos contra el
   rol runtime, sin usar datos clínicos reales.
3. Para índices, seleccionar primero las consultas Easyvet con mayor latencia o
   frecuencia y comparar `EXPLAIN (ANALYZE, BUFFERS)` antes y después; no aplicar los
   137 avisos como una migración automática.

Esta evidencia no sustituye una revisión de producción ni una revisión profesional
de seguridad de infraestructura.
