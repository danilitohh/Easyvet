# Fase 6E.3A — UI read-only de cuidado preventivo

## Resultado

Se migró la lectura de vacunaciones y desparasitaciones de la historia clínica
de Easyvet. La superficie está limitada a consulta histórica: no crea,
actualiza, finaliza ni anula registros y no presenta acciones de inventario,
facturación o documentos.

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

## Criterios de seguridad

- Cambio de organización o paciente: se limpian datos previos y se cancela la
  solicitud pendiente.
- Recurso de otro paciente: respuesta de recurso no encontrado.
- Encuentro padre anulado: aviso histórico, sin mutación de estado.
- Paciente archivado: indicador visible, sin CTA operativo.
- Campos clínicos y notas: texto escapado por React.
- Fechas civiles: componentes de fecha, no timestamps UTC.

## Fuera de alcance

La creación y operación de borradores, finalización, anulación y cualquier
workflow de disponibilidad pertenecen a Fase 6E.3B o posteriores. No se
crearon migraciones, modelos ni endpoints en esta fase.
