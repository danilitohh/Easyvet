# Autorización clínica — Fases 6B.1–6B.2

## Separación de responsabilidades

`MembershipRole` continúa siendo la matriz operativa existente. `ClinicalRole`
es nullable y ortogonal: solo `PRACTITIONER` o `CLINICAL_ASSISTANT` añaden
permisos clínicos. Un `PLATFORM_ADMIN` no obtiene acceso clínico automático y
siempre necesita un Membership activo en el tenant seleccionado.

`MembershipProfessionalProfile` es una relación 1:0..1 tenant-aware. Guarda
únicamente `displayName` y `licenseNumber` nullable, además de sus timestamps.
La matrícula no es obligatoria para el modelo; la política de finalización
futura exigirá Membership activo, `ClinicalRole=PRACTITIONER` y perfil válido.

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

`PRACTITIONER` recibe todos los permisos clínicos, incluidos los cinco de
prescripciones. `CLINICAL_ASSISTANT` recibe lectura
del expediente/encuentro/evolución/vitales, creación y edición de drafts de
encuentro y creación de vitales, además de leer/crear/editar drafts de
prescripciones; no recibe `finalize` ni `void` de prescripciones, ni
`clinicalEvolutions.create` por defecto. Las funciones de autorización
combinan permisos organizacionales y clínicos, eliminando duplicados.

La finalización de una receta requiere además que el Membership actor sea el
prescriptor indicado y tenga perfil profesional con `displayName`. Un rol
organizacional aislado (`OWNER`, `ADMIN`, `RECEPTION`, `GROOMER` o `CASHIER`) y
un `PLATFORM_ADMIN` sin Membership clínico no obtienen acceso por defecto.

## Alcance de la fase

La resolución viaja en el contexto autenticado y en `/auth/me`. La Fase 6B.2
aplica estos permisos en todas las rutas clínicas, deriva el actor del
Membership activo y mantiene `PLATFORM_ADMIN` sin acceso clínico implícito.
La UI clínica y los side effects externos sobre Agenda, documentos o
notificaciones siguen fuera de alcance.
