# Referencia legacy: propietarios y pacientes

## Alcance y fuentes

Este documento resume la evidencia disponible en la auditoría de Lativet. No se
modifica el código legacy ni se importan datos. Las fuentes analizadas fueron
`docs/migration/DATA_MODEL_LEGACY.md`, `BUSINESS_RULES.md`, `MODULE_MAP.md` y
`MIGRATION_RISKS.md`, que citan los módulos legacy de propietarios y pacientes.

Cuando la auditoría no permite confirmar un detalle de implementación, se marca
`NEEDS REVIEW` en vez de inventar una compatibilidad.

## Propietario (Owner)

La entidad legacy `owners` representa al responsable de una o varias mascotas.
La auditoría confirma nombre, identificación, teléfonos, email y dirección,
además de una relación uno-a-muchos con pacientes. La identificación es
opcional; cuando existe, el par tipo+número tiene unicidad parcial.

Reglas observadas:

- Alta y edición con nombre y datos de contacto opcionales.
- Búsqueda por nombre, identificación y datos de contacto.
- La identificación no es necesariamente global; la unicidad observada es
  parcial y depende de tipo+número.
- El borrado legacy elimina manualmente pacientes y dependencias clínicas,
  agenda, peluquería y ventas. No es seguro trasladar ese `DELETE` a un SaaS.

`NEEDS REVIEW`: la auditoría no confirma una separación fiable entre nombre y
apellido, formato universal de documentos, normalización de teléfonos ni la
política de retención por país.

## Paciente (Patient)

La entidad legacy `patients` contiene identidad clínica, especie, raza, sexo,
nacimiento/edad, peso, microchip, foto y estados preventivos/vitales. Tiene una
FK a Owner y no existe una unicidad de nombre por propietario protegida por la
base.

Reglas observadas:

- Un paciente debe pertenecer a un propietario existente y compatible.
- El servicio impedía dos pacientes con el mismo nombre para un propietario,
  pero la base no imponía ese constraint.
- El peso informado debe ser positivo. El peso actual se recalcula desde una
  serie de registros clínicos; por eso un campo de ficha solo puede ser un
  snapshot, nunca el historial.
- El estado clínico legacy distinguía Activa/Fallecida y registraba eventos de
  fallecimiento/reactivación. Esos eventos pertenecen a fases clínicas futuras.
- La auditoría no confirma una unicidad de microchip; Fase 4A lo conserva como
  dato buscable sin constraint global o por tenant.
- Existían fotos y datos preventivos; storage, vacunas y desparasitaciones
  quedan fuera de Fase 4A.
- El borrado físico elimina citas, recordatorios, seguimientos, firmas,
  consentimientos, consultas, evoluciones e historia relacionada.

`NEEDS REVIEW`: catálogo de especies, valores exactos de sexo, formato de
microchip, fecha aproximada de nacimiento y reglas de reactivación no están
formalizados suficientemente en la auditoría.

## Decisiones de Fase 4A

- Owner usa `firstName` y `lastName`; `lastName` es opcional para no impedir
  nombres de una sola palabra. Una futura importación puede conservar un nombre
  legacy completo en `firstName` hasta que se confirme una partición mejor.
- `documentType` es texto extensible y `documentNumber` conserva el valor de
  presentación; `documentNumberNormalized` permite unicidad por organización,
  tipo y número sin fijar una regulación nacional.
- Owner y Patient usan `ACTIVE`/`ARCHIVED` más `archivedAt`. Archivar no borra,
  no cascada y conserva la posibilidad de historial futuro.
- Patient usa `species` y `breed` como texto validado, no un catálogo global.
  `sex` usa `MALE`, `FEMALE` o `UNKNOWN` y no se mezcla con `sterilized`.
- `birthDate` es opcional y `birthDateEstimated` distingue una fecha aproximada.
- `currentWeightKg` es un snapshot positivo y no sustituye los registros
  longitudinales de consultas, que pertenecen a una fase posterior.
- Un Patient tiene un Owner principal. La auditoría no demuestra que múltiples
  propietarios sean un requisito inmediato; se pospone un modelo de contactos
  adicionales.
- Los listados excluyen archivados por defecto. El acceso directo a un recurso
  archivado sigue siendo posible para usuarios autorizados del mismo tenant.
- No se crea `Breed`, historial de peso, eventos de estado, fotos, vacunas ni
  tablas de clínica en esta fase.

## Dependencias y riesgos

Owner y Patient son dependencias de agenda, clínica, peluquería y facturación,
pero esas áreas no se migran ahora. Owner clínico y cliente de facturación deben
seguir siendo conceptos separados hasta una decisión explícita. Los borrados
legacy son destructivos y amplios; Easyvet usa archive para evitar pérdida de
historial y deja la auditoría de archive/merge/transferencia para una fase
posterior.
