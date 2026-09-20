# Riesgos de reimplementación

## Propósito

Este registro identifica comportamiento que puede perderse o cambiarse accidentalmente al construir el producto futuro. No propone ni inicia la Fase 1.

## Riesgos críticos

| Riesgo                               | Comportamiento legado que puede perderse                                                                                | Consecuencia                                               | Tratamiento antes de migrar                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Aislamiento multi-tenant inexistente | Todas las tablas, settings, secuencias, archivos, usuarios e integraciones son globales                                 | Fuga cruzada entre clínicas                                | Definir el límite de organización y pruebas negativas para cada operación/consulta/job/archivo                 |
| Factura como operación compuesta     | Crear factura modifica documento, líneas, inventario, pagos y caja bajo una transacción compartida                      | Saldos, stock o caja divergentes                           | Especificar invariantes y casos de rollback; caracterizar create/update/delete                                 |
| Edición destructiva de factura       | Editar revierte stock, elimina pagos/caja y reconstruye efectos                                                         | Pérdida de trazabilidad o duplicados                       | Decidir si se conserva o se reemplaza por documentos correctivos; no traducir literalmente sin decisión fiscal |
| Borrados clínicos en cascada         | Propietario/paciente/historia/consulta borran manualmente numerosos dependientes                                        | Pérdida irreversible y violación de retención              | Inventariar cascadas, definir soft-delete/anonimización/retención y autorización                               |
| Rutinas automáticas de arranque      | La inicialización puede cambiar esquema, hacer backfills y vaciar/restaurar inventario/facturación si falta un marcador | Pérdida masiva de datos                                    | Excluir todo reset/corrección histórica; migraciones explícitas, revisables y reversibles                      |
| Modelo clínico polimórfico           | Subtipos viven en `clinical_consultations.document_reference` y contratos frontend                                      | Campos clínicos omitidos o interpretados mal               | Catalogar payloads por tipo y versionarlos antes de diseñar destino                                            |
| Firma ligada al documento            | Hash, expiración, código, evidencia y contenido JSON funcionan como una cadena                                          | Firma aplicada a versión incorrecta o evidencia incompleta | Definir contrato legal/técnico y pruebas de inmutabilidad                                                      |
| Cierres no bloqueantes               | El cierre es snapshot y las mutaciones posteriores lo invalidan                                                         | Cambiar semántica contable sin advertir                    | Decidir modelo de cierre/reapertura/corrección con experto contable                                            |
| Permisos heredados y modernos        | Solo perfiles `@actions:v1` reciben control granular                                                                    | Importar privilegios excesivos                             | Mapear cada usuario/rol a un modelo nuevo fail-closed; no copiar listas crudas                                 |
| Informes agregados                   | `reports` incluye colecciones clínicas/personales completas                                                             | Fugas de PII y tenant                                      | Crear contratos mínimos de informe y políticas explícitas por campo                                            |

## Riesgos altos por dominio

### Arquitectura y dependencias

- `LativetService` y `Database` son fachadas que enlazan funciones de muchos módulos. Separar archivos no equivale a límites de dominio; deben localizarse las transacciones y llamadas cruzadas antes de asignar módulos nuevos.
- El contexto transaccional compartido permite que funciones de diferentes módulos participen en una sola transacción. Sustituirlo por varios repositorios sin unidad de trabajo puede dejar commits parciales.
- SQLite y PostgreSQL no necesariamente tienen DDL idéntico; el esquema efectivo se complementa en runtime. No generar un modelo Prisma únicamente desde migraciones Supabase.
- El endpoint bootstrap puede cargar gran parte del sistema y el frontend asume nombres/forma exacta de colecciones. Cambiar DTOs exige identificar consumidores.

### Frontend

- `scripts/module_manifest.json` define orden de ejecución global. Mover funciones a módulos ES puede revelar dependencias implícitas de orden/variables globales.
- La navegación usa `activeSectionId` y DOM compartido, no rutas. React deberá preservar enlaces de entrada, estado de filtros/modales y sincronización de historial de forma consciente.
- Las pantallas no son fuente confiable de autorización: varios controles se ocultan por permisos, pero la regla definitiva debe estar en backend.
- El cache de bootstrap conserva datos durante seis horas. Eliminarlo cambia rendimiento/offline; copiarlo conserva un riesgo de PII. Requiere decisión.
- Estado en `sessionStorage`, `localStorage`, `BroadcastChannel` y eventos entre pestañas afecta login visual, firmas y refresco de datos.
- Los artefactos `Frontend/public/app.js`, `styles.css` e `index.html` son generados. No deben migrarse como fuente ni editarse.
- Componentes como editor de documento dependen de HTML persistido y exportadores backend; una nueva librería rich-text puede cambiar el HTML y romper hash/firma/PDF.

### Historia clínica

- Finalización bloquea edición directa, pero no evoluciones. Una UI nueva que permita editar indiscriminadamente rompe trazabilidad.
- Guardar una consulta estándar inicial puede reflejar campos hacia la historia. Eliminar esta sincronización deja resúmenes vacíos o duplicados.
- Retención se extiende al anexar evoluciones; migrar solo `retention_until` sin reconstruir su regla puede producir fechas incorrectas.
- Peso actual se deriva de registros/consultas y se recalcula tras borrado. Copiar solo `patients.weight_kg` pierde historial; copiar solo historial sin recalcular altera ficha.
- Vacunas/desparasitaciones escriben estados resumidos en paciente además de la consulta.
- Laboratorios pendientes pueden fusionarse por paciente/título; una importación ingenua puede preservar duplicados que la UI no espera.

### Agenda y automatización

- Las reglas de disponibilidad solo se exigen si existe alguna; una organización sin reglas opera distinto de una configurada.
- El conflicto actual es global. Añadir sucursales/profesionales sin decidir el recurso de conflicto puede sobre-reservar o bloquear demasiado.
- Reservas rápidas crean entidades placeholder. Debe decidirse si se importan, se convierten o se eliminan con revisión.
- Controles derivados usan cita de duración fija y pueden coexistir con recordatorios/seguimientos.
- Jobs dependen de timezone y estados pendientes. Reejecutarlos tras importar puede duplicar correos si no hay idempotencia.

### Documentos, adjuntos y firmas

- Parte del contenido está en JSON/data URL/base64 dentro de DB; otra parte vive como archivo local. No hay una única fuente de archivos.
- Las respuestas compactas reemplazan adjuntos embebidos por URLs de asset. Migrar solo respuestas exportadas o solo JSON puede perder binarios.
- La edición restaura referencias a assets omitidas por el cliente; cambiar a PUT semántico puede borrarlas accidentalmente.
- Enlaces de firma son bearer tokens. No deben importarse como activos ni enviarse durante ensayos.
- Una nueva representación HTML cambia el hash del documento y puede invalidar firmas existentes. Conservar evidencia requiere una versión canónica inmutable.
- PDFs/DOCX dependen de identidad, logo, plantillas, fuentes y reglas de salto/página. Validar contenido, no solo apariencia.
- El storage local no es durable en serverless; el futuro `StorageService` necesita autorización, tenancy, metadatos, checksum, lifecycle y borrado.

### Peluquería

- Acepta clientes vinculados y no vinculados; forzar siempre propietario/paciente clínico cambia el flujo comercial.
- El consentimiento se implementa como consulta clínica sintética. Migrar solo `grooming_documents` pierde la evidencia; migrar ambos sin deduplicar puede duplicarla.
- Borrar peluquería elimina sus documentos/firma vinculados. Debe decidirse una política de conservación legal.

### Facturación y pagos

- Cotización y factura comparten tabla, pero solo factura tiene efectos contables/stock.
- Clientes de venta son distintos de propietarios clínicos; fusionarlos por nombre/email puede mezclar identidades.
- Existen placeholders técnicos heredados para registros sin propietario/paciente. Requieren clasificación, no copia ciega.
- El pago mixto debe cuadrar exactamente; redondeos monetarios deben caracterizarse.
- Registrar/borrar pago cambia saldo, estado, caja y cierres. Debe ser atómico e idempotente.
- Secuencias/números de documentos son globales a la instalación. En SaaS deben definirse por organización/sucursal/tipo y preservarse referencias históricas.
- **NECESITA REVISIÓN:** impuestos, moneda, numeración fiscal, notas crédito/débito y requisitos colombianos no están suficientemente formalizados para asumir un modelo universal.

### Inventario y compras

- Facturación impide stock negativo, pero ajustes manuales y ciertas reversiones no. “Corregir” esto cambia operaciones existentes; decidir política.
- Compra puede afectar o no stock. Importar todas como entradas duplicaría inventario.
- Editar/borrar compra revierte movimientos previos; las relaciones origen deben preservarse.
- Conteo físico genera diferencias y snapshot; no debe importarse como simple valor actual.
- Vencimiento parece asociado al producto, no a múltiples lotes. Un SaaS con lotes debe transformar con reglas confirmadas.
- La restauración histórica del catálogo no restaura kardex. Los marcadores/rutinas de reset no deben pasar al nuevo producto.

### Caja y cierres

- Las cuentas `caja_menor`, `caja_mayor` y `transferencia` son convenciones fijas, no un catálogo multi-tenant.
- Transferencias son pares; importar un lado rompe saldos.
- Después de cierre, el borrado crea anulación y reverso en otro período/sesión; antes de cierre puede borrar físicamente. El orden temporal importa.
- Movimientos automáticos vinculados a documentos/pagos no deben editarse/borrarse como manuales.
- Aportes/devoluciones de socios combinan préstamo y caja.
- Cierres mensuales se invalidan al cambiar períodos anteriores. No recalcular automáticamente durante una importación sin un plan.
- Una migración SQL contiene una corrección de una operación financiera real. Debe excluirse por completo.

### Seguridad y datos personales

- Importar cookies, claves de sesión, tokens Google, credenciales SMTP, DSN o enlaces de firma compromete ambos sistemas.
- `audit_log` puede contener payloads sensibles y una copia de la contraseña SMTP. Necesita saneamiento antes de cualquier exportación/importación.
- El cache del navegador, exports locales y backups pueden conservar PII fuera de la base.
- El endurecimiento RLS versionado no demuestra cobertura de todas las tablas actuales.
- Mensajes de error contienen excepciones internas; no deben convertirse en contratos REST del sistema nuevo.

## Elementos específicos de Lativet que no deben migrarse como producto

| Elemento                                              | Ubicación/tipo                                                    | Decisión recomendada                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Nombre “Lativet” e identidad visual                   | `DEFAULT_SETTINGS`, plantillas, frontend, manifest, imágenes/logo | Convertir en branding configurable; no seed global                                    |
| Datos de contacto/dirección/correos de la clínica     | settings, plantillas y potenciales datos runtime                  | Importar solo mediante proyecto de datos autorizado y por tenant; nunca como defaults |
| Logo, avatares e imágenes propias                     | `Frontend/**/Recursos`, configuración y datos                     | Clasificar licencia/propiedad; no asumir activos universales                          |
| Plantillas y textos legales colombianos               | configuración y generadores documentales                          | Validar legalmente y versionar por país/organización                                  |
| Retención predeterminada de 15 años                   | `DEFAULT_SETTINGS`                                                | Política configurable validada jurídicamente                                          |
| Timezone de Bogotá                                    | `DEFAULT_SETTINGS`                                                | Configuración de organización/sucursal                                                |
| Cuentas de caja fijas                                 | constantes de base/Caja                                           | Catálogo por organización con mapeo de importación                                    |
| Métodos de pago y categorías fijas                    | constantes de ventas/caja                                         | Parametrizar; conservar códigos históricos mediante mapeo                             |
| Categorías e iconos iniciales de catálogo             | seeds/backfills/recursos                                          | No tratar como catálogo universal                                                     |
| Propietarios, pacientes, usuarios y documentos reales | bases y archivos ignorados                                        | No se revisaron; no migrar sin autorización, minimización y plan específico           |
| PDFs/DOCX/exports/backups existentes                  | `data/exports`, `data/backups`                                    | No copiar automáticamente; inventario y consentimiento explícito                      |
| Credenciales/tokens/sesiones                          | entorno, settings, archivos Google, DB                            | Excluir y rotar/reautorizar                                                           |
| Corrección financiera puntual                         | migración SQL de anulación/reverso                                | Excluir de schema, seed y proceso genérico                                            |
| Marcadores y backups de resets “one time”             | tablas auxiliares/runtime                                         | Excluir; son historia técnica, no dominio                                             |
| Placeholder owners/patients                           | reservas y compatibilidad de facturación                          | Clasificar y transformar con decisión humana                                          |
| Archivos generados de frontend                        | `Frontend/public`                                                 | No migrar; son build artifacts                                                        |
| Cache `lativet_*` del navegador                       | localStorage/sessionStorage                                       | No conservar ni importar                                                              |

## Dependencias frontend–backend que requieren pruebas de caracterización

1. Forma y carga parcial de `/api/bootstrap`, incluida filtración por permisos.
2. Nombres de estados y tipos clínicos/financieros usados como claves de UI.
3. Payload JSON de cada formulario clínico y su `document_reference`.
4. Respuestas compactas y rutas de assets/exports.
5. Semántica de DELETE y rutas POST alternativas de borrado.
6. Actualizaciones entre pestañas y refresco posterior a firma.
7. Redondeo, totales y desglose de pagos en POS.
8. Secuencias y estados de caja: abrir → auditar → cerrar → reabrir/anular.
9. Render HTML → PDF/DOCX → hash → firma.
10. Filtros por permisos de bootstrap, documentos y exportaciones.

## Funcionalidades frágiles

- Ensamblado del frontend por orden del manifiesto.
- Consulta clínica genérica y sus muchos subtipos.
- Restauración/streaming de adjuntos embebidos.
- Sincronización consulta ↔ historia ↔ ficha de paciente.
- Factura/pago ↔ stock ↔ caja ↔ cierre.
- Compra/conteo ↔ kardex ↔ cierre.
- Anulación de caja después de cierre y movimientos pareados.
- Consentimiento de peluquería materializado como documento clínico.
- Firma pública, hashing de documento y evidencia.
- Google OAuth/callback y creación de enlaces desde host externo.
- Borrados manuales con autorización de múltiples dominios.
- Bootstrap/reportes con colecciones anidadas.

## Preguntas y ambigüedades para decisión humana

1. ¿Cuál es la unidad exacta de tenant: organización, clínica, razón social o sucursal? ¿Un usuario puede pertenecer a varias?
2. ¿Las sucursales compartirán pacientes, inventario, numeración, caja, agenda y configuración o tendrán partición propia?
3. ¿El conflicto de agenda debe ser global, por profesional, por sede, por consultorio/equipo o una combinación?
4. ¿Se conservará una identidad administrativa de emergencia? Si sí, ¿cómo se custodia, audita y limita?
5. ¿Qué roles heredados existen realmente y cuál es el grant esperado de cada uno?
6. ¿`is_active` debe permitir suspender usuarios y revocar todas sus sesiones?
7. ¿Historia, evolución, firma, factura y cierre deben ser inmutables? ¿Qué correcciones legales se permiten?
8. ¿Cuál es la política legal de retención por país/tipo de documento y qué se anonimiza al borrar un cliente?
9. ¿Propietario clínico y cliente de facturación son una persona común con perfiles o entidades separadas?
10. ¿Qué subtipos clínicos y campos son obligatorios? Falta un contrato canónico fuera de la UI.
11. ¿Se requieren múltiples lotes, fechas de vencimiento, seriales y estrategia FEFO en inventario?
12. ¿Se permite stock negativo? ¿En ajustes, compras revertidas o ventas?
13. ¿Una factura emitida puede editarse como hoy o debe corregirse con notas/documentos nuevos?
14. ¿Qué requisitos fiscales, monedas, impuestos y numeraciones debe soportar el producto?
15. ¿Cierre mensual debe bloquear el período o seguir siendo un snapshot invalidable?
16. ¿Las tres cuentas de caja y los préstamos de socios son universales o exclusivos de Lativet?
17. ¿La firma por código de email cumple el nivel legal requerido? ¿Se conservará el HTML/PDF exacto firmado?
18. ¿El correo saldrá desde la plataforma o desde credenciales de cada clínica?
19. ¿Google Calendar se conecta por organización, sucursal, profesional o calendario/recurso?
20. ¿Qué datos/archivos reales se migrarán, con qué autorización y mediante qué reconciliación?
21. ¿Qué placeholders y correcciones históricas deben descartarse, fusionarse o conservarse como evidencia?
22. ¿Los textos legales y la operación se limitarán inicialmente a Colombia?
23. ¿Existe una instancia PostgreSQL/Supabase cuyo esquema difiera del código y las migraciones versionadas?
24. ¿Qué SLA, RPO/RTO, política de backups y recuperación requiere el SaaS?
25. ¿Qué datos deben funcionar offline y, si aplica, cómo se protegerán en dispositivos compartidos?

## Condición de salida de Fase 0

Antes de implementar, las respuestas anteriores deben convertirse en decisiones de producto/dominio y criterios verificables. Esta auditoría no autoriza ejecutar migraciones, importar datos, reutilizar credenciales ni modificar Lativet.
