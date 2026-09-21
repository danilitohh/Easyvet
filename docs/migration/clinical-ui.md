# Fases 6C.1–6C.2A — Frontend clínico y borradores

## Completado

- Historia y detalle de encuentro con rutas semánticas y deep links.
- Empty state para `clinicalRecord: null`, con acción `Nueva consulta` únicamente cuando el
  paciente está activo y la membresía tiene `clinicalEncounters.create`.
- Lectura paginada newest-first de encuentros.
- Estados DRAFT/FINALIZED/VOIDED, snapshots históricos de propietario y profesional, y paciente archivado.
- Lectura opcional de citas, signos vitales y evoluciones según permisos efectivos.
- Tenant switch con cancelación y limpieza de cargas; acceso cross-tenant queda en 404 seguro.
- Diseño responsive, textos largos escapados y estados de carga/error accesibles.

## Fase 6C.2A — completado

- Perfil profesional self-service por membresía y organización activa, sin campos de identidad
  controlados por el cliente.
- Creación y edición de `ClinicalEncounter` en `DRAFT`, con permisos de Practitioner/Clinical
  Assistant, optimistic concurrency, mensajes de stale/immutable y protección contra paciente
  archivado.
- Selector tenant-safe de sedes activas, citas acotadas al paciente y profesionales Practitioner;
  la ubicación de una cita enlazada debe coincidir.
- Registro append-only de signos vitales opcionales para drafts. El peso en draft no proyecta
  `Patient.currentWeightKg`.
- Aviso persistente para Practitioner sin perfil: “Completa tu perfil profesional antes de poder
  finalizar consultas.”
- Rutas semánticas `/perfil/profesional`, `/pacientes/:patientId/historia/nueva` y
  `/pacientes/:patientId/historia/encuentros/:encounterId/editar`; los cambios de tenant limpian
  estado y cancelan requests.

## Fuera de alcance

Finalizar, anular y crear evoluciones permanecen fuera del frontend. No se inició Fase 6C.2B ni
Fase 6C.3 (hardening).

## Verificación

La suite frontend cubre render de historia, estados, snapshots, vitales, textos largos y warnings de anulación. La validación completa del monorepo se ejecuta con los comandos de checkpoint de la fase; Docker/PostgreSQL y QA manual deben reportarse por separado cuando no estén disponibles.
