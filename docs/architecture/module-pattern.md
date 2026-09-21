# Patrón de módulos de Easyvet

Owners + Patients validan una secuencia simple para futuros módulos. Es una
guía de consistencia, no un framework obligatorio ni una abstracción que deba
aplicarse mecánicamente:

```text
Prisma model
    ↓
Migration
    ↓
Tenant-aware service
    ↓
Permission
    ↓
REST controller
    ↓
Shared contract
    ↓
API client
    ↓
React page/hooks
    ↓
Tests
    ↓
Docs
```

Cada módulo debe definir primero su frontera de tenant y sus invariantes de
base de datos. El service recibe la organización desde el contexto autenticado,
los controladores declaran permisos por operación y los contratos excluyen
campos internos. El frontend separa páginas, API clients y hooks; los recursos
dependientes de tenant limpian estado al cambiar de organización.

Las decisiones no confirmadas por legacy se documentan como `NEEDS REVIEW` en
vez de convertirse en comportamiento implícito. Archive, restore, auditoría y
relaciones adicionales requieren una decisión de dominio antes de ampliar el
modelo.

El cierre del Clinical Core añade tres reglas reutilizables cuando un módulo
maneja evidencia irreversible:

- los estados terminales se protegen en backend con una transición explícita y
  compare-and-set; ocultar botones no sustituye la invariante del servicio;
- los hechos históricos guardan snapshots de identidad o contexto que no deben
  rehidratarse desde perfiles vivos;
- toda relación entre agregados tenant-scoped usa una FK compuesta o una
  validación equivalente dentro de la transacción.
