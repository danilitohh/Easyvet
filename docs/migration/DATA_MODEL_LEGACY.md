# Modelo de datos legado

## Alcance

Este documento reconstruye el modelo desde `Backend/BASE_DE_DATOS/database.py`, los módulos `persistencia.py` y `Backend/BASE_DE_DATOS/supabase/migrations`. No representa el estado de ninguna base desplegada. No se abrió ni consultó una base real.

## Vista conceptual

```text
Owner ──< Patient ──< ClinicalRecord ──< ClinicalEvolution
  │          │               │
  │          │               └──< ClinicalConsultation
  │          │                         ├──< PatientWeightRecord
  │          │                         ├──0..1 ControlReminder
  │          │                         ├──< ClinicalFollowup
  │          │                         └──< DocumentSignatureRequest
  │          ├──< Appointment
  │          ├──< Consent
  │          ├──< PatientStatusEvent
  │          └──< GroomingDocument
  │
  ├──< BillingClient (relación de negocio; no necesariamente FK directa)
  └──< BillingDocument ──< BillingDocumentItem >── CatalogItem >── Provider
                │                 │                    │
                ├──< Payment ─────┴──> CashMovement   ├──< StockMovement
                │                                      ├──< PhysicalCount
                └──────────────> CashMovement          └──< PurchaseItem >── Purchase

CashSession agrupa movimientos por fecha/cuenta
PartnerLoan se vincula a movimientos de caja
MonthClosure captura un snapshot financiero mensual
StaffUser y Settings son globales en la instalación
AuditLog registra cambios de múltiples entidades
```

La dirección anterior expresa cardinalidad conceptual. Varias relaciones se implementan por texto/JSON o se mantienen manualmente y no poseen una FK real.

## Selección de motor y ciclo de vida

- `Backend/COMPARTIDO/Servicios/api.py` elige PostgreSQL si existe una de las variables de conexión reconocidas; de lo contrario usa `data/lativet.sqlite3`.
- `Database` configura SQLite con foreign keys, WAL, sincronización normal y espera de bloqueo.
- `PostgresDatabase` usa `psycopg`, adapta placeholders y normaliza SQL mediante código propio.
- El constructor inicializa esquema, agrega columnas faltantes, crea índices, ejecuta backfills y rutinas de datos “one time”. Por tanto, el estado final no depende solo de las migraciones SQL versionadas.
- No existe una columna `tenant_id`, `organization_id` o `clinic_id` en las entidades de negocio. La base completa pertenece a una sola instalación.

## Entidades y tablas

### Configuración, seguridad y operación

| Tabla                                     | Clave                          | Propósito y campos relevantes                                                                      | Relaciones / observaciones                                                              |
| ----------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `settings`                                | `key`                          | Pares globales de configuración; incluye valores de clínica, correo, agenda, plantillas y secretos | Sin tenant; la contraseña SMTP se almacena aquí                                         |
| `staff_users`                             | `id`                           | Usuario, email, rol, matrícula, permisos JSON, hash de contraseña, flags y timestamps              | Email se valida como único desde la aplicación; `is_active` no se respeta efectivamente |
| `audit_log`                               | identificador interno/registro | Tipo/id de entidad, acción, actor, payload JSON y fecha                                            | Payload heterogéneo; puede contener PII y secretos; no es inmutable                     |
| `administrative_reset_backups`            | id                             | Copias lógicas relacionadas con reinicios administrativos                                          | Función de entrega/operación heredada                                                   |
| `one_time_data_migrations`                | clave de migración             | Marcadores de tareas automáticas ejecutadas                                                        | Controla cambios de datos desde el arranque                                             |
| `one_time_inventory_billing_reset_backup` | id/registro                    | Respaldo temporal de la rutina de reset de inventario/facturación                                  | Específico de una transición histórica                                                  |
| `owners_optional_contact_migration`       | temporal                       | Soporte temporal para migrar contactos opcionales                                                  | No es entidad de producto                                                               |

### Personas, pacientes y agenda

| Tabla                       | Clave | Propósito y campos relevantes                                                                               | Relaciones / constraints                                                     |
| --------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `owners`                    | `id`  | Nombre, identificación, teléfonos, email y dirección del responsable                                        | Índice único parcial por tipo+número de identificación cuando existe         |
| `patients`                  | `id`  | Identidad clínica, especie, raza, sexo, nacimiento/edad, peso, microchip, foto, estados preventivos y vital | FK `owner_id → owners.id`; no hay constraint de nombre único por propietario |
| `patient_status_events`     | `id`  | Historial de fallecimiento/reactivación y responsable                                                       | Referencia a paciente; esquema creado en runtime                             |
| `patient_weight_records`    | `id`  | Peso longitudinal capturado por consulta                                                                    | FK a paciente y consulta; consulta única para evitar doble registro          |
| `appointments`              | `id`  | Fecha/hora, duración, tipo, estado, observaciones, profesional, origen y referencias Google/control         | FK a paciente y propietario; dependencias también se limpian manualmente     |
| `agenda_availability_rules` | `id`  | Regla de disponibilidad por fecha/día, horas y tamaño de slot                                               | No modela por sí sola recursos múltiples de manera concluyente               |

### Clínica y documentos

| Tabla                         | Clave             | Propósito y campos relevantes                                                                                           | Relaciones / constraints                                                              |
| ----------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `clinical_records`            | `id`              | Número, apertura, estado, datos clínicos base, profesional, finalización y retención                                    | FK a paciente y propietario                                                           |
| `clinical_evolutions`         | `id`              | Nota posterior, autor y fecha                                                                                           | FK `record_id → clinical_records.id`                                                  |
| `clinical_consultations`      | `id`              | Fecha, tipo, título, resumen, indicaciones, adjuntos, consentimiento, profesional y `document_reference`                | FK a historia, paciente y propietario; muchos subtipos viven en JSON/texto            |
| `control_reminders`           | `id`              | Control derivado de consulta, fecha, clase, estado de entrega y error                                                   | Consulta conceptualmente única; referencias parcialmente lógicas                      |
| `clinical_followups`          | `id`              | Fecha programada, resultado, evolución, estado, contacto y próxima fecha                                                | Unicidad por consulta+fecha programada                                                |
| `consents`                    | `id`              | Tipo, texto/evidencia, responsable, paciente, profesional y fecha                                                       | FK a paciente/propietario; `record_id` y `consultation_id` se añadieron sin FK fuerte |
| `document_signature_requests` | `id`; token único | Token, referencias clínicas, email, estado, hashes, código, intentos, firma, identidad, IP/UA, auditoría y expiraciones | FK/lazos a consulta, historia, paciente y propietario; token indexado                 |
| `grooming_documents`          | `id`              | Cliente/mascota vinculados u opcionales, servicios JSON, fotos, rabia, estado y consentimiento JSON                     | Paciente/propietario pueden ser nulos; puede enlazar una consulta de consentimiento   |

### Ventas, inventario y caja

| Tabla                        | Clave | Propósito y campos relevantes                                                                                  | Relaciones / constraints                                                                          |
| ---------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `billing_clients`            | `id`  | Cliente de venta independiente del propietario clínico                                                         | Índice único parcial por identificación; evita crear fichas clínicas para venta mostrador         |
| `billing_providers`          | `id`  | Proveedor y contacto                                                                                           | Referenciado por catálogo y compras                                                               |
| `billing_catalog_categories` | `id`  | Nombre normalizado, orden/estado                                                                               | Nombre normalizado con unicidad lógica/índice                                                     |
| `billing_catalog_items`      | `id`  | Producto/servicio, categoría, proveedor, costo, margen, precio, stock, vencimiento, imagen y archivado         | FK opcional a proveedor/categoría según versión; centro de inventario                             |
| `billing_documents`          | `id`  | Tipo cotización/factura, secuencia/número, cliente, propietario/paciente, fechas, estado, totales y título PDF | Paciente se volvió nullable; índices de secuencia/número; FK a owner/client/patient según esquema |
| `billing_document_items`     | `id`  | Línea, descripción, cantidad, precio, descuento/impuestos/totales                                              | FK a documento y opcional a ítem de catálogo                                                      |
| `billing_document_payments`  | `id`  | Abono, fecha, método, monto y datos de soporte                                                                 | FK a documento; genera movimiento de caja relacionado                                             |
| `billing_cash_movements`     | `id`  | Secuencia, ingreso/gasto, cuenta, categoría, monto, vínculos, transferencias, anulaciones y reversos           | FK lógica/real a documento/pago; índice único parcial por origen de reverso                       |
| `billing_partner_loans`      | `id`  | Aporte o devolución de socios                                                                                  | Referencia un movimiento de caja                                                                  |
| `billing_cash_sessions`      | `id`  | Fecha/cuenta, apertura, arqueo, cierre, esperados, contados, diferencias y destinos                            | Única por fecha+cuenta                                                                            |
| `billing_month_closures`     | `id`  | Mes, snapshot JSON/totales, responsable y timestamps                                                           | `month_key` único; se elimina/invalida al mutar períodos afectados                                |
| `billing_stock_movements`    | `id`  | Entrada/salida/ajuste, cantidad, saldo, fecha y origen                                                         | Referencias a ítem, documento o compra; kardex                                                    |
| `billing_physical_counts`    | `id`  | Conteo por ítem, diferencia y responsable                                                                      | Registro/snapshot por ítem; creado en runtime y migración posterior                               |
| `billing_purchases`          | `id`  | Proveedor, fecha, totales, descuento global, estado y flag de afectar inventario                               | FK a proveedor; actualizar/borrar puede revertir stock                                            |
| `billing_purchase_items`     | `id`  | Ítem comprado, cantidad, coste y total                                                                         | FK a compra con `ON DELETE CASCADE`; FK al catálogo                                               |

## Relaciones fuertes y relaciones lógicas

### Relaciones fuertes observadas

- propietario → pacientes;
- historia → evoluciones;
- historia/paciente/propietario → consultas;
- documento de venta → líneas y pagos;
- compra → líneas con cascada;
- catálogo → movimientos/conteos/líneas;
- proveedor → catálogo/compras;
- documento/pago → movimiento de caja, según la versión del esquema.

### Relaciones lógicas o mantenidas por aplicación

- `consents.record_id` y `consents.consultation_id`;
- referencias de control y seguimiento a consultas/citas;
- `grooming_documents` a la consulta sintética de consentimiento;
- movimientos pareados de transferencia, préstamo, anulación y reverso;
- `document_reference` como JSON polimórfico, incluyendo adjuntos y evidencia de firma;
- propietario clínico frente a `billing_clients` para venta mostrador;
- cierres mensuales frente a las transacciones que los invalidan.

La futura normalización debe decidir qué relaciones requieren FK, qué historiales deben ser append-only y qué contenido semiestructurado merece entidades propias.

## Índices y constraints relevantes

Se encontraron, entre otros:

- unicidad parcial de identificación de propietario y cliente de facturación;
- token de solicitud de firma;
- consulta+fecha en seguimientos;
- consulta en registros de peso/control cuando corresponde;
- fecha+cuenta en sesiones de caja;
- clave mensual en cierres;
- origen único de movimiento de reverso;
- secuencia/número de documento de venta;
- nombre normalizado de categoría;
- índices de búsqueda por nombres normalizados de propietarios, pacientes, proveedores y catálogo;
- índices por FK/fecha para agenda, consultas, grooming, caja, stock, documentos y pagos.

No toda regla está protegida por DB. Ejemplos: paciente duplicado por propietario+nombre, stock no negativo, desglose exacto de pagos, compatibilidad propietario/paciente y autorización se controlan en aplicación.

## Modelo polimórfico de consultas

`clinical_consultations` es el contenedor de muchos módulos. `consultation_type` distingue consulta general, vacunación, fórmula, desparasitación, ambulatorio, hospitalización, cirugía/procedimiento, anestesia, laboratorio, imagen, control fotográfico, seguimiento, documento y remisión. Los campos comunes están en columnas; el contenido específico se serializa principalmente en `document_reference` y resúmenes.

Consecuencias:

- el esquema real de cada subtipo está repartido entre JavaScript, validadores, servicios y exportadores;
- los adjuntos pueden aparecer embebidos como data URL y luego exponerse por rutas de asset;
- una migración puramente tabular puede perder campos que no aparecen en el DDL;
- debe definirse una estrategia explícita: tablas por subtipo, JSONB versionado o una combinación.

## Configuración inicial y seeds

No se encontraron seeds con propietarios, pacientes o usuarios reales. Sí existen:

- `DEFAULT_SETTINGS` en `Backend/BASE_DE_DATOS/contexto.py`, con nombre Lativet, timezone, retención, servidor/puerto SMTP, cuenta de caja, plantillas y calendario por defecto;
- categorías de catálogo por defecto y convenciones financieras;
- recursos gráficos e imágenes de demostración/avatares;
- backfills que derivan estado preventivo, iconos de producto y compatibilidad de contactos.

Estos valores son defaults de la instalación y no deben convertirse automáticamente en datos globales del SaaS.

## Migraciones Supabase versionadas

Se encontraron diez archivos en `Backend/BASE_DE_DATOS/supabase/migrations`:

1. endurecimiento RLS y revocación para una lista fija de tablas;
2. índices de rendimiento;
3. columnas opcionales de peluquería;
4. datos de cliente de peluquería;
5. conteos físicos;
6. título de PDF de documento de venta;
7. flag de compra que afecta inventario;
8. anulación/reverso de caja y una corrección de datos puntual;
9. descuento total de compra;
10. documentos de venta sin paciente obligatorio.

Hallazgos importantes:

- el README afirma que RLS cubre todas las tablas, pero la migración utiliza una lista fija anterior y omite tablas añadidas después, entre ellas clientes de facturación, préstamos de socios, conteos físicos, compras, categorías, cierres, seguimientos y estados de pacientes;
- el estado aplicado en una base real es **NECESITA REVISIÓN**;
- una migración de caja contiene una corrección asociada a una operación real concreta identificada por fecha, concepto, cuenta y monto. Es dato/compensación específica de Lativet y no debe migrarse al esquema ni a los datos iniciales del SaaS;
- `apply_security_fix.sql` duplica parte del endurecimiento y agrega DDL, por lo que el historial efectivo no es una única cadena inequívoca.

## Esquema administrado en runtime

El código de `Database`/`PostgresDatabase` puede:

- crear tablas si no existen;
- agregar columnas e índices;
- cambiar nulabilidad en PostgreSQL;
- crear tablas auxiliares;
- ejecutar backfills;
- lanzar rutinas “one time” al construir la conexión.

El riesgo más alto es `_run_one_time_inventory_billing_reset`: si falta el marcador esperado, crea un respaldo lógico y elimina datos de catálogo, stock, compras, facturación y pagos; otra rutina restaura el catálogo, pero no todo el historial. Esta operación no representa una regla de negocio y debe excluirse totalmente de cualquier arranque futuro.

## Backups y archivos

- SQLite: backup a `data/backups/` con timestamp.
- PostgreSQL: la aplicación no implementa backup; debe depender de infraestructura.
- Exportaciones: `data/exports/` y subcarpetas para clínica, documentos, fórmulas, facturación, pagos, informes e inventario.
- Google: `credentials.json` y `token.json` en su integración.
- Los directorios de datos/credenciales están ignorados por Git, pero debe confirmarse el historial del repositorio y los despliegues.

## Decisiones pendientes para el modelo nuevo

- Definir `Organization/Tenant`, pertenencia de usuarios y rol por organización.
- Definir sucursal, profesional, consultorio/recurso y timezone por organización/sucursal.
- Determinar si propietario y cliente de facturación son una persona compartida con perfiles o entidades separadas.
- Determinar el modelo fiscal de documentos, secuencias, impuestos, notas y anulaciones por país/organización.
- Formalizar lotes y vencimientos: el legado no demuestra un modelo de lote suficientemente separado.
- Decidir normalización/versionado de subtipos clínicos y documentos.
- Definir retención, borrado, anonimización y auditoría inmutable por categoría de dato.
- Definir cómo importar ids, timestamps, numeraciones, adjuntos y evidencias sin ejecutar rutinas automáticas del legado.
- Confirmar cuáles constraints existen realmente en PostgreSQL/Supabase desplegado.
