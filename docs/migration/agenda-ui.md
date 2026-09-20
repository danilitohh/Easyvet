# Migración de Agenda — frontend de solo lectura

## Resultado

Fase 5C.1 reemplaza el placeholder visual de `/agenda` por una lectura real de
las citas de Easyvet. La UI consume los endpoints de Agenda de Fase 5B y no
introduce tablas, endpoints ni permisos nuevos.

## Alcance implementado

- Calendario mensual, semanal, diario y de lista.
- Estado `view`/`date` compartible en la URL.
- Detalle en `/agenda/citas/:appointmentId`.
- Filtros por sede, profesional, estado y paciente con búsqueda paginada.
- Zona horaria obtenida de la organización activa y conversión civil con
  Temporal.
- Cancelación de peticiones y limpieza de datos al cambiar de tenant.
- Estados de carga, error, vacío y advertencia parcial de referencias.
- Responsive desktop/tablet/390 px y controles básicos de accesibilidad.

## Verificación

La suite web incluye 30 pruebas específicas para mapeo de eventos, estados,
fechas civiles, rangos, filtros y navegación URL/tenant. También se conserva la
suite existente del AppShell, auth, owners y patients. La verificación completa
del repositorio se ejecuta como parte del checkpoint de esta fase.

## Manual QA realizado

Con `owner.norte@demo.local` y la contraseña local del seed, contra la base
`easyvet_dev` (inyectando `DATABASE_URL` al iniciar el API), se verificaron:

- login y navegación desde Dashboard a `/agenda`;
- mes con cuatro citas seed y estados `SCHEDULED`, `WAITING_ROOM`,
  `COMPLETED` y `CANCELLED`;
- navegación mes → semana → día → lista, con actualización de `view`/`date`;
- hora mostrada en `America/Bogota`, filtros cargados desde API y detalle
  navegable en `/agenda/citas/:appointmentId`;
- detalle de Patient, Owner, sede, profesional, estado, duración y
  confirmaciones.

El smoke también encontró y corrigió un ciclo de actualización de FullCalendar
al sincronizar `datesSet`; después de la corrección la pantalla dejó de quedar
en blanco. La comprobación visual de viewport móvil de 390 px y el cambio de
tenant mediante usuario multi-organización quedan para la pasada manual de
regresión/hardening.

El `.env` local por defecto todavía apunta a la base histórica
`veterinary_saas`, donde la migración de Agenda no está aplicada; contra esa
base el endpoint de citas devuelve 500 por tabla ausente. No se modificó esa
base ni el backend: la verificación se hizo sobre `easyvet_dev`, que es la base
local aprobada por Fase 5B.

## Fuera de alcance

Las operaciones de Agenda —crear, editar, reprogramar, cancelar, check-in,
iniciar, completar, `NO_SHOW`, confirmaciones y disponibilidad— quedan en
**PENDIENTE FASE 5C.2**. El hardening final queda en **PENDIENTE FASE 5D**.
