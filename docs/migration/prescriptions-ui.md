# Revisión de UI de Prescriptions — Fase 6D.3A

## Alcance verificado

La UI consume únicamente los endpoints read-only de Fase 6D.2 y usa
`prescriptions.read` como permiso efectivo. No se agregó un endpoint paralelo ni
se duplicó la consulta de recetas del Encounter: el detalle filtra el listado
del Patient por `clinicalEncounterId`.

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

## Aislamiento

La navegación se limpia en cada cambio de Membership activa. Las requests se
abortan, el estado anterior no se reutiliza y un deep link cross-tenant se
presenta como “Recurso no encontrado”. El frontend no intenta inferir ni
mostrar la organización propietaria del recurso.

## Pendientes explícitos

La fase no implementa mutaciones, creación de recetas, PDF, impresión, firma,
Storage, email, inventario, ventas, facturación ni catálogo de medicamentos.
La fase siguiente deberá revisar esos flujos sin reabrir este contrato
read-only.
