# Frontend Procedures, Surgery y Anesthesia — Fase 6F.3

Estado: frontend y hardening de 6F COMPLETADOS. Los agregados y endpoints
continúan separados: la agrupación visual no introduce un evento clínico
genérico.

## Navegación

Desde la historia del Patient hay una entrada a “Procedimientos” cuando existe
permiso efectivo de lectura en al menos uno de los dos dominios. La pantalla
combina secciones independientes de Procedures/Surgery y Anesthesia, y omite
por completo el dominio que el usuario no puede leer. El detalle de Encounter
presenta listado y acciones de alta según permiso y lifecycle del Encounter.

| Experiencia                               | Ruta                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------- |
| Historia de Procedures/Surgery/Anesthesia | `/pacientes/:patientId/historia/procedimientos`                               |
| Detalle de Procedure/Surgery              | `/pacientes/:patientId/historia/procedimientos/:procedureId`                  |
| Crear Procedure/Surgery desde Encounter   | `/pacientes/:patientId/historia/encuentros/:encounterId/procedimientos/nuevo` |
| Editar Draft de Procedure/Surgery         | `/pacientes/:patientId/historia/procedimientos/:procedureId/editar`           |
| Detalle anestésico                        | `/pacientes/:patientId/historia/anestesias/:anesthesiaRecordId`               |
| Crear Anesthesia desde Encounter          | `/pacientes/:patientId/historia/encuentros/:encounterId/anestesias/nueva`     |
| Editar Draft anestésico                   | `/pacientes/:patientId/historia/anestesias/:anesthesiaRecordId/editar`        |

Las rutas permiten navegación directa, recarga y uso del historial del
navegador. El listado combinado no cambia los límites de autorización ni el
lifecycle de cada agregado.

## Formularios y lifecycle

- Procedure y Surgery comparten el formulario clínico, pero Surgery presenta su
  bloque `ClinicalSurgeryDetail` (asistente, área, lado, sangrado y cierre).
  Cambiar de Surgery a Procedure requiere confirmación antes de eliminar el
  detalle específico en el mismo update Draft. No se ofrece editar evidencia
  FINALIZED/VOIDED.
- El profesional responsable y el asistente se eligen por membresías clínicas
  activas del tenant. Un Assistant puede crear/editar Draft y estar asignado
  como asistente quirúrgico; no puede finalizar ni anular.
- Anesthesia permite registro standalone o vínculo opcional a Surgery/Procedure
  elegible del mismo Patient y Encounter. Los cambios del vínculo siguen
  sujetos a CAS. Si el padre ya es VOIDED, la relación puede retirarse o
  cambiarse a un destino válido; las demás modificaciones Draft siguen
  bloqueadas mientras se mantenga un padre anulado.
- Finalize y Void son acciones distintas, con revisión/confirmación, motivo de
  anulación requerido e incremento de versión. Las pantallas finales son de
  solo lectura. Snapshot de Patient, Owner histórico, responsable y Assistant
  se presenta desde la respuesta del servidor y no se recalcula en React.
- Fecha/hora de los formularios se interpreta con `Organization.timezone`; no
  se impone una regla global de pasado/futuro en la UI.

## Monitorización

La pantalla de detalle muestra observaciones en orden entregado por el API.
Mientras el padre está DRAFT, las acciones agregar, editar y quitar usan el
`expectedVersion` del AnesthesiaRecord. Luego de finalizar, la serie es de solo
lectura. La UI preserva cero como un valor numérico válido (incluidos HR, RR y
EtCO₂); los valores ausentes se mantienen distintos de cero.

## Permisos, estados obsoletos y tenant

La UI consulta permisos efectivos `procedures.read/create/updateDraft/finalize/void`
y `anesthesia.read/create/updateDraft/finalize/void`. No realiza una consulta
de listado ni presenta empty state para un dominio sin permiso `read`. El
servidor sigue siendo la autoridad para actor, estado, versión y aislamiento.
Respuestas de conflicto y versiones stale se muestran como feedback recuperable
sin asumir que la mutación se guardó.

Los hooks compartidos de lectura habilitan requests según permisos, vinculan su
estado a la organización seleccionada y descartan resultados de requests
cancelados/obsoletos. Un cambio de tenant desmonta el contexto del formulario;
los valores no guardados no se copian al tenant nuevo. Los deep links de otro
tenant muestran no encontrado sin revelar la existencia del registro. No se
mantiene una caché clínica local entre organizaciones.

## Accesibilidad y responsive

Las acciones están disponibles como enlaces o botones con nombres accesibles;
formularios y errores conservan etiquetas y mensajes textuales. Las secciones
de historia usan headings semánticos y separan los dominios. En QA manual, la
historia de Procedures/Anesthesia en viewport de 390 px no produjo overflow
horizontal. Los formularios/detalles usan los contenedores responsive del
shell de la aplicación.

## Alcance que permanece fuera de 6F

No se incorporaron Consent, documentos, reportes, PDF, Storage, firmas,
medicamentos anestésicos estructurados, dispositivos de monitorización,
catálogos, inventario, billing, importación histórica ni plantillas
quirúrgicas configurables. La matriz y decisión de cada integración están en
[`../migration/procedures-anesthesia-final-review.md`](../migration/procedures-anesthesia-final-review.md).
