# Frontend clínico read-only

## Alcance de Fase 6C.1

El frontend clínico expone únicamente lectura del núcleo clínico existente:

- `/pacientes/:patientId/historia` muestra el `ClinicalRecord`, encuentros paginados y evoluciones de record sin encuentro.
- `/pacientes/:patientId/historia/encuentros/:encounterId` muestra el snapshot histórico del encuentro, narrativa, planes, signos vitales y evoluciones relacionadas.
- La pantalla de historia enlaza desde la ficha de Patient únicamente cuando la membresía efectiva tiene `clinicalRecords.read`.
- No existen botones ni clientes React para crear, editar, finalizar, anular, registrar vitales o agregar evoluciones.

## Autorización y tenant

Las rutas se protegen por `clinicalRecords.read` y `clinicalEncounters.read`; las secciones de vitales, evoluciones y citas se habilitan de forma independiente con `clinicalVitals.read`, `clinicalEvolutions.read` y `appointments.read`. La ausencia de `clinicalRole` no se compensa con `patients.read`, y `PLATFORM_ADMIN` no recibe acceso clínico por sí solo.

Los hooks cancelan solicitudes en curso y limpian sus datos al cambiar `activeMembership.organization.id`. Un encuentro obtenido por otro tenant se presenta como recurso no encontrado. Los errores 401/403/404/409/500 pasan por la capa de mensajes públicos existente.

## Fechas, snapshots y accesibilidad

Las fechas se formatean con el timezone de `GET /organization/current`. El paciente actual y el propietario histórico se presentan con etiquetas explícitas. Los estados tienen texto visible (`Borrador`, `Finalizado`, `Anulado`), y el borrado lógico del paciente se muestra como `Archivado`. Los textos clínicos se renderizan como texto plano escapado con saltos conservados; no se usa HTML inseguro.

La carga de las páginas es lazy para mantener el shell principal liviano. Las tarjetas y listas se adaptan a 390px sin depender de color para comunicar estado.
