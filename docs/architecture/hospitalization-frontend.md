# Hospitalization V1 — frontend

Las rutas son semánticas y deep-linkables:

- /pacientes/:patientId/historia/hospitalizaciones
- /pacientes/:patientId/historia/hospitalizaciones/:hospitalizationId
- /pacientes/:patientId/historia/hospitalizaciones/:hospitalizationId/editar
- creación contextual desde /pacientes/:patientId/historia/encuentros/:encounterId

La historia clínica y el detalle del encuentro muestran el acceso solo cuando el permiso efectivo existe. El detalle presenta status, snapshots, encuentro padre, paciente archivado, advertencia de Encounter anulado y Kardex. DRAFT permite edición; ACTIVE muestra únicamente “Actualizar plan” y permite añadir entries; DISCHARGED y VOIDED son solo lectura salvo la anulación correctiva autorizada.

El formulario normaliza fechas civiles con la zona horaria de la organización, usa labels asociados, errores accesibles, confirmaciones para activar/alta/anulación y limpia solicitudes stale al cambiar de tenant. El Kardex se representa como tarjetas cronológicas, sin tabla ancha: admite cero para HR/RR, no presenta controles de editar/eliminar y conserva notas largas en 390 px.

Los clientes validan payloads y respuestas Zod antes de renderizar. Un deep link cross-tenant queda en error 404 sin mostrar identificadores ajenos.
