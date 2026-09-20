# Plan de multi-tenancy

La plataforma futura será multi-tenant. `Organization` será la frontera principal de aislamiento; esta fase no crea esa entidad ni implementa sus guards.

## Decisiones que deben preceder a la Fase 3

- relación usuario–organización mediante `Membership` y roles por organización;
- posibilidad de sucursales, profesionales y recursos compartidos;
- estrategia de aislamiento: scoping obligatorio de aplicación, políticas PostgreSQL/RLS o combinación;
- claves únicas e índices siempre compuestos por organización cuando aplique;
- separación de archivos, exports, cache, jobs, integraciones y numeraciones;
- auditoría que conserve organización, actor, request y motivo;
- pruebas de no-fuga entre organizaciones para cada repositorio y endpoint.

## Restricciones para el código actual

El scaffold no debe introducir singletons de negocio globales, tablas sin una futura clave de organización razonable, rutas que asuman una única clínica ni configuración productiva embebida. La ausencia temporal de `Organization` es intencional y no autoriza usar el estado global como contrato de dominio.
