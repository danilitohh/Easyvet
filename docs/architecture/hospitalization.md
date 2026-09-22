# Hospitalization V1 — modelo y decisiones

Fase 6G implementa una hospitalización/ambulatorio como agregado clínico tenant-safe, siempre ligado a un ClinicalEncounter y al Patient histórico del encuentro. El agregado es opcional por encuentro (0..1); un nuevo episodio usa un nuevo encuentro.

## Lifecycle

DRAFT → ACTIVE → DISCHARGED y ACTIVE → VOIDED y DISCHARGED → VOIDED. No existe reapertura, transición a DRAFT ni DELETE físico. El SQL mantiene coherencia entre status, timestamps, actores, snapshots y versión.

DRAFT permite preparación incompleta. Activar exige fecha de ingreso, responsable Practitioner activo con perfil y actor exactamente igual al responsable. La activación congela snapshots de paciente, propietario y profesional. Un episodio activo solo permite actualizar plan, ubicación, diagnóstico, medicamentos, dieta y notas; identidad y snapshots no cambian.

## Kardex

HospitalizationEntry es append-only y solo se crea mientras el root está ACTIVE. Soporta evolución, monitoreo, medicación, enfermería, dieta y otros registros. Un registro requiere texto o al menos una medición. Temperatura y peso deben ser positivos; frecuencia cardiaca y respiratoria aceptan cero. Registrar peso no modifica Patient.currentWeightKg.

## Consistencia y privacidad

Las FKs incluyen organizationId y usan RESTRICT. Las mutaciones toman locks en orden Encounter → Patient → Hospitalization → Owner → Memberships (Memberships ordenadas por ID), usan CAS por version y registran únicamente metadatos estructurales en ClinicalAuditEvent. No se persiste narrativa, medicación o signos vitales en la auditoría.

El archivado de Patient bloquea mientras exista un episodio ACTIVE. Un Encounter VOIDED bloquea crear/modificar/activar/entries/alta de DRAFT o ACTIVE; episodios descargados continúan siendo legibles y pueden anularse como corrección explícita. No hay inventario, farmacia, MAR avanzado, camas, facturación, dispositivos ni efectos derivados en esta fase.
