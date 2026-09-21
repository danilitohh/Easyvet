# Autorización clínica — Fase 6B.1

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

`PRACTITIONER` recibe los diez permisos. `CLINICAL_ASSISTANT` recibe lectura
del expediente/encuentro/evolución/vitales, creación y edición de drafts de
encuentro y creación de vitales; no recibe `finalize`, `void` ni
`clinicalEvolutions.create` por defecto. Las funciones de autorización
combinan permisos organizacionales y clínicos, eliminando duplicados.

## Alcance de la fase

La resolución ya viaja en el contexto autenticado y en `/auth/me`, pero no
existen rutas clínicas en 6B.1. No se implementan todavía creación de
encuentros vía API, finalización, anulación, evoluciones, vitales, snapshots,
CAS, frontend ni side effects sobre Patient. Esos cambios pertenecen a 6B.2.
