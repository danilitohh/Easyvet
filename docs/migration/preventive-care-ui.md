# Fases 6E.3A–6E.3B — UI de cuidado preventivo

## Resultado

Se migró la lectura de vacunaciones y desparasitaciones de la historia clínica
de Easyvet. La Fase 6E.3B añade borradores contextuales, edición, finalización
y anulación sin presentar acciones de inventario, facturación o documentos.

## Correspondencia con el backend 6E.2

Cada dominio conserva su permiso (`vaccinations.read` y
`dewormings.read`), cliente HTTP, hook, paginación y detalle. Las respuestas se
validan contra los contratos publicados por `@veterinary-saas/contracts`. El
frontend no replica reglas de lifecycle ni calcula snapshots; únicamente
presenta el estado y los datos derivados que entrega el backend.

## Integración clínica

La entrada de cuidado preventivo aparece en `ClinicalHistoryPage` cuando existe
al menos un permiso de lectura. `ClinicalEncounterDetailPage` incluye bloques
filtrados por el encuentro padre y respeta los permisos por separado. El
detalle preventivo ofrece enlace al encuentro únicamente cuando el usuario
tiene `clinicalEncounters.read`.

En el detalle de un `ClinicalEncounter` DRAFT o FINALIZED aparecen las acciones
`Registrar vacunación` y `Registrar desparasitación` según sus permisos.
Encounter VOIDED y Patient ARCHIVED no ofrecen create. Los formularios no
vuelven a pedir Patient/Encounter y la finalización/anulación vive únicamente
en el detalle preventivo.

Los formularios usan fechas civiles controladas, CAS en edición, warnings de
vencimiento no bloqueantes, selector explícito de `administeredBy`, revisión de
finalización y motivo obligatorio para void. Los snapshots siguen siendo
calculados por backend. No se implementan reminders, inventory, certificates,
catalogs, PDF, storage ni automatizaciones.

## Criterios de seguridad

- Cambio de organización o paciente: se limpian datos previos y se cancela la
  solicitud pendiente.
- Recurso de otro paciente: respuesta de recurso no encontrado.
- Encuentro padre anulado: aviso histórico, sin mutación de estado.
- Paciente archivado: indicador visible, sin CTA operativo.
- Campos clínicos y notas: texto escapado por React.
- Fechas civiles: componentes de fecha, no timestamps UTC.

## Estado

La lectura y las operaciones de Preventive Care están completadas en 6E.3A y
6E.3B. El hardening específico queda pendiente para 6E.4.
