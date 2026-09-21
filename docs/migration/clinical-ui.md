# Fase 6C.1 — Frontend clínico en modo lectura

## Completado

- Historia y detalle de encuentro con rutas semánticas y deep links.
- Empty state para `clinicalRecord: null`, sin acción de creación.
- Lectura paginada newest-first de encuentros.
- Estados DRAFT/FINALIZED/VOIDED, snapshots históricos de propietario y profesional, y paciente archivado.
- Lectura opcional de citas, signos vitales y evoluciones según permisos efectivos.
- Tenant switch con cancelación y limpieza de cargas; acceso cross-tenant queda en 404 seguro.
- Diseño responsive, textos largos escapados y estados de carga/error accesibles.

## Fuera de alcance

Las mutaciones clínicas permanecen fuera del frontend. No se inició Fase 6C.2 (operaciones clínicas) ni Fase 6C.3 (hardening).

## Verificación

La suite frontend cubre render de historia, estados, snapshots, vitales, textos largos y warnings de anulación. La validación completa del monorepo se ejecuta con los comandos de checkpoint de la fase; Docker/PostgreSQL y QA manual deben reportarse por separado cuando no estén disponibles.
