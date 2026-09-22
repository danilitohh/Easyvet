# Autorización clínica — Fases 6B.1–6B.2, 6E.2, 6F.2A y 6F.2B

## Separación de responsabilidades

`MembershipRole` continúa siendo la matriz operativa existente. `ClinicalRole`
es nullable y ortogonal: solo `PRACTITIONER` o `CLINICAL_ASSISTANT` añaden
permisos clínicos. Un `PLATFORM_ADMIN` no obtiene acceso clínico automático y
siempre necesita un Membership activo en el tenant seleccionado.

`MembershipProfessionalProfile` es una relación 1:0..1 tenant-aware. Guarda
únicamente `displayName` y `licenseNumber` nullable, además de sus timestamps.
La matrícula no es obligatoria para el modelo; las finalizaciones clínicas y
preventivas validan Membership activo, `ClinicalRole=PRACTITIONER` y perfil
válido cuando la operación lo requiere.

## Permisos implementados

El catálogo base contiene exactamente:

- `clinicalRecords.read`
- `clinicalEncounters.read`, `clinicalEncounters.create`,
  `clinicalEncounters.updateDraft`, `clinicalEncounters.finalize`,
  `clinicalEncounters.void`
- `clinicalEvolutions.read`, `clinicalEvolutions.create`
- `clinicalVitals.read`, `clinicalVitals.create`
- `prescriptions.read`, `prescriptions.create`, `prescriptions.updateDraft`,
  `prescriptions.finalize`, `prescriptions.void`
- `vaccinations.read`, `vaccinations.create`, `vaccinations.updateDraft`,
  `vaccinations.finalize`, `vaccinations.void`
- `dewormings.read`, `dewormings.create`, `dewormings.updateDraft`,
  `dewormings.finalize`, `dewormings.void`
- `procedures.read`, `procedures.create`, `procedures.updateDraft`,
  `procedures.finalize`, `procedures.void`
- `anesthesia.read`, `anesthesia.create`, `anesthesia.updateDraft`,
  `anesthesia.finalize`, `anesthesia.void`

`PRACTITIONER` recibe todos los permisos clínicos, incluidos los cinco de
prescripciones. `CLINICAL_ASSISTANT` recibe lectura
del expediente/encuentro/evolución/vitales, creación y edición de drafts de
encuentro y creación de vitales, además de leer/crear/editar drafts de
prescripciones, vacunaciones, desparasitaciones, procedimientos y anestesia; no
recibe `finalize` ni `void` de esos satélites ni `clinicalEvolutions.create` por
defecto. Las funciones de autorización combinan permisos organizacionales y
clínicos, eliminando duplicados.

La finalización de una receta o de un preventivo requiere además que el
Membership actor sea el responsable indicado y tenga perfil profesional con
`displayName`; en Preventive Care `administeredBy` puede ser Practitioner o
Clinical Assistant activo con perfil para snapshot. Un rol
organizacional aislado (`OWNER`, `ADMIN`, `RECEPTION`, `GROOMER` o `CASHIER`) y
un `PLATFORM_ADMIN` sin Membership clínico no obtienen acceso por defecto.

## Alcance de la fase

La resolución viaja en el contexto autenticado y en `/auth/me`. La Fase 6B.2
aplica estos permisos en todas las rutas clínicas, deriva el actor del
Membership activo y mantiene `PLATFORM_ADMIN` sin acceso clínico implícito.
La UI clínica y los side effects externos sobre Agenda, documentos o
notificaciones siguen fuera de alcance.

## Endpoint de miembros clínicos

`GET /api/v1/clinical/members` exige `clinicalRecords.read`, deriva el tenant
de la sesión y filtra simultáneamente `Membership.status=ACTIVE`,
`User.status=ACTIVE` y `ClinicalRole IN (PRACTITIONER, CLINICAL_ASSISTANT)`.
Devuelve solo `membershipId`, `clinicalRole`, `displayName` y
`profileConfigured`; no es un endpoint de directorio y no expone email ni
matrícula. Todas las operaciones de Preventive Care vuelven a validar estas
condiciones dentro de su transacción antes de congelar snapshots o anular.

## Procedures/Surgery 6F.2A

`PRACTITIONER` obtiene los cinco permisos `procedures.*`. `CLINICAL_ASSISTANT`
puede leer, crear y editar únicamente drafts; no puede finalizar ni anular. La
finalización requiere que el actor sea el Practitioner responsable con perfil
configurado. Un Assistant activo con perfil puede ser miembro de equipo en
`ClinicalSurgeryDetail`, pero su selección no le concede autoridad para
finalizar. Los roles organizacionales por sí solos y `PLATFORM_ADMIN` sin
Membership clínico no reciben capacidades clínicas implícitas. Las
Membership/User/Profile se revalidan bajo locks dentro de las transacciones.

## Anesthesia 6F.2B

`PRACTITIONER` obtiene los cinco permisos `anesthesia.*`. `CLINICAL_ASSISTANT`
puede leer, crear y editar únicamente drafts, incluyendo agregar, corregir y
eliminar observations mientras el `AnesthesiaRecord` siga en `DRAFT`; no puede
finalizar ni anular. Finalizar requiere que el actor sea el Practitioner
responsable con perfil configurado. Los roles organizacionales por sí solos y
`PLATFORM_ADMIN` sin Membership clínico no reciben capacidades clínicas
implícitas. Membership/User/Profile se revalidan bajo locks dentro de las
transacciones.
