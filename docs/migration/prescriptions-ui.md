# Revisión de UI de Prescriptions — Fases 6D.3A–6D.3B

## Alcance verificado

La UI consume los endpoints de Fase 6D.2 y usa permisos separados para lectura,
draft, finalización y anulación. No se agregó un endpoint paralelo ni se
duplicó la consulta de recetas del Encounter: el detalle filtra el listado del
Patient por `clinicalEncounterId`.

La entrada de creación es contextual al Encounter y no permite cambiar Patient
o Encounter dentro del formulario. Edición, finalización y anulación se abren
desde el detalle; se mantienen múltiples recetas por Encounter.

## Invariantes de presentación

- `DRAFT` es Borrador y nunca “receta emitida”.
- `FINALIZED` muestra `finalizedAt`, profesional histórico y matrícula histórica
  cuando existe.
- `VOIDED` muestra motivo/hora y mantiene items, snapshots y diagnóstico.
- Un Encounter `VOIDED` genera un aviso separado y no cambia el status de la
  Prescription.
- Patient y Owner snapshots no se reemplazan con nombres actuales.
- Items se muestran por `position ASC` y los campos vacíos se omiten.
- Diagnóstico, dosis, frecuencia, duración y observaciones permanecen como
  texto plano, con saltos de línea.
- Los drafts aceptan cero items; al guardar se envía el conjunto completo con
  posiciones normalizadas. El nombre del medicamento es el único campo
  obligatorio del editor.
- Los controles arriba/abajo permiten ordenar sin drag-and-drop; quitar no
  borra la prescripción, solo modifica el próximo reemplazo atómico.
- El editor usa `expectedVersion` y ante stale conserva el formulario local
  hasta una recarga explícita. No existe merge automático.
- Finalizar muestra revisión de paciente, consulta, prescriptor, matrícula,
  items y versión; anular exige un motivo y conserva todos los snapshots.

## Aislamiento

La navegación se limpia en cada cambio de Membership activa. Las requests se
abortan, el estado anterior no se reutiliza y un deep link cross-tenant se
presenta como “Recurso no encontrado”. El frontend no intenta inferir ni
mostrar la organización propietaria del recurso.

El cambio de tenant cierra formularios y diálogos, aborta mutaciones en curso y
limpia errores. Un Encounter padre `VOIDED` bloquea crear/editar y detiene una
mutación concurrente; si la receta ya estaba finalizada, permanece histórica.
La API sigue siendo la autoridad para permisos, CAS y aislamiento.

## Pendientes explícitos

No se implementan PDF, impresión, firma, Storage, email, inventario, ventas,
facturación, catálogo de medicamentos ni fármacos controlados. El hardening
6D.4 queda pendiente sin reabrir el contrato de operaciones.
