# Fase 6G — revisión final de migración

## Legacy relevante

En Lativet-reference, commit 05fea495cb13208b27bf470b3570987fd501a81e, el área Hospitalizaciones_ambulatorios combina ingreso, ubicación, responsable, tratamiento, medicamentos, dieta, monitoreo, altas y un Kardex operativo; Historia/Consultas aporta el encuentro y los snapshots históricos. También existen visitas ambulatorias, autosave, checklist de administración, alertas de fluidos y exportación PDF del Kardex.

Easyvet V1 conserva ingreso, ubicación, responsable, diagnóstico, tratamiento, medicación textual, dieta, alta, evoluciones y monitoreo. Deliberadamente deja fuera inventario/farmacia, MAR avanzado, turnos, camas configurables, fluidos, PDF, dispositivos, facturación y side effects hasta decisiones posteriores.

## Implementación

- Prisma: Hospitalization y HospitalizationEntry, con migración 20260922120000_add_hospitalizations.
- Backend: servicio/controller/module tenant-safe, CAS, locks, snapshots, lifecycle, entries append-only y auditoría estructural.
- Frontend: lista, detalle, formularios, Kardex, activation, discharge, void, integración en historial/encuentro y rutas semánticas.
- Seed: Norte contiene DRAFT, ACTIVE con entries y DISCHARGED con entries; Sur contiene un DRAFT. Los identificadores son estables e idempotentes y solo se ejecutan mediante npm run db:seed sobre la base local configurada.

## Evidencia

La integración PostgreSQL cubre aislamiento, permisos clínicos, lifecycle, snapshots, CAS, entradas vacías/mediciones, cero HR/RR, no mutación del peso del Patient, alta, anulación y lectura cross-tenant. La suite frontend cubre rutas, etiquetas de lifecycle, links semánticos y estado sin permiso.

Las migraciones se aplicaron únicamente a easyvet_dev y easyvet_test. Docker/PostgreSQL local quedó healthy; no se tocaron bases compartidas ni productivas y no se creó commit durante este cierre.
