# Owners y Patients (Fase 4A)

## Modelo

`Organization` es la frontera de seguridad. `Owner` y `Patient` almacenan
`organizationId` y todos los servicios reciben ese valor explícitamente. Un
`Patient` tiene un Owner principal; la relación usa una FK compuesta
`(ownerId, organizationId)` para que PostgreSQL también impida mezclar
organizaciones.

Owner conserva `firstName`, `lastName` opcional, identificación extensible,
contactos, dirección, notas y estado. La identificación es opcional y solo se
considera duplicada cuando existen tipo y número normalizado dentro de la misma
organización.

Patient conserva nombre, especie y raza como texto extensible, sexo explícito,
nacimiento opcional con indicador de aproximación, color, microchip, peso actual
como snapshot, esterilización, notas y estado. No contiene consultas, vacunas,
historia, fotos ni peso longitudinal.

## Consultas y respuestas

Los listados usan `page`/`pageSize` (por defecto 20, máximo 100), `search`,
`status=ACTIVE|ARCHIVED|ALL`, y ordenamiento mediante allowlists de campos. Las
búsquedas de Owner cubren nombre, documento, email y teléfono; las de Patient
cubren nombre, microchip y datos básicos del Owner. Nunca se acepta un campo de
orden arbitrario ni `organizationId` del cliente.

Los detalles exponen únicamente campos de dominio seguros. Owner puede incluir
sus Patients activos; Patient incluye un resumen mínimo de su Owner. No se
simulan arrays de consultas, facturas o citas.

## Archive

Archive reemplaza el borrado físico en Fase 4A. Las operaciones son idempotentes,
no cascadan y escriben `archivedAt`. Los listados activos excluyen archivados;
los detalles directos de un recurso archivado siguen disponibles con permiso y
tenant correctos. La restauración, merge de propietarios, transferencia de
responsabilidad y auditoría formal quedan para fases posteriores.

## Límites de fase

No se crean múltiples propietarios por paciente, catálogos de razas, historial
de peso, eventos clínicos, storage de fotos ni módulos de agenda/clínica.
`currentWeightKg` es una proyección conveniente y no sustituye las mediciones
clínicas futuras.
