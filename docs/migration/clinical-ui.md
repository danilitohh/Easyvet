# Fases 6C.1–6C.2B — Frontend clínico y operación clínica

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

## Fase 6C.2B — completado

- Revisión y finalización de DRAFT con autorización estricta del Practitioner responsable,
  perfil profesional obligatorio, `expectedVersion`, manejo de stale y snapshots inmutables.
- Finalizados quedan en modo lectura: no permiten editar, guardar draft ni agregar vitales; el
  profesional/licencia se leen desde el snapshot histórico.
- Evoluciones append-only desde encuentros FINALIZED o desde un ClinicalRecord existente; el
  formulario exige narrativa, muestra autor y no acepta identidad/tenant desde el cliente.
- Anulación irreversible de FINALIZED con motivo obligatorio, confirmación fuerte, CAS, historia
  retenida, vitales visibles con advertencia y recálculo transaccional de peso.
- Acciones y rutas están protegidas por permisos efectivos y estado, con tenant switch/deep links
  revalidados; no se añadieron migraciones ni tablas.

## Fuera de alcance

Satélites clínicos y Fase 6C.3 (hardening) no se iniciaron.

## Verificación

La suite frontend cubre render de historia, estados, snapshots, vitales, finalización, evoluciones,
anulación, textos largos y conflictos. La validación completa del monorepo se ejecuta con los
comandos de checkpoint de la fase; Docker/PostgreSQL y QA manual deben reportarse por separado.
