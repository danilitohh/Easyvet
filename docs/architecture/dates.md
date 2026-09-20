# Fechas y tiempo

- Los timestamps persistidos se almacenarán en UTC.
- La zona horaria será configurable por `Organization` cuando exista el modelo multi-tenant.
- El frontend presentará fechas en la zona del contexto del usuario/organización.
- Jobs futuros deben convertir explícitamente entre UTC y la zona operativa, con idempotencia.

La Fase 1 no implementa lógica de agenda, retención ni recurrencia.
