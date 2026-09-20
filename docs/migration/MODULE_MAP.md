# Mapa de módulos legado

## Lectura del mapa

Las rutas se expresan relativas al repositorio Lativet. “Compartida” indica que el comportamiento se implementa sobre entidades genéricas —sobre todo `clinical_consultations` o `billing_documents`— y se distingue por tipo y JSON, no por una tabla propia. La complejidad describe rasgos observables; no es una puntuación.

| Módulo                                | Frontend                                                        | Backend                                                                     | Persistencia                                                              | Integraciones                | Dependencias                                     | Complejidad                                           |
| ------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| Inicio / Dashboard                    | `Frontend/COMPARTIDO/Inicio`                                    | `Backend/COMPARTIDO/Inicio`; agregado en `BASE_DE_DATOS/database.py`        | Lecturas agregadas de todo el dominio                                     | Ninguna directa              | Pacientes, agenda, consultas, peluquería, ventas | Agregación de múltiples entidades                     |
| Autenticación                         | `Frontend/COMPARTIDO/Autenticacion`                             | `Backend/COMPARTIDO/Autenticacion`; middleware en `COMPARTIDO/Rutas/web.py` | `staff_users`; cookie Flask                                               | Variables de entorno         | Usuarios y permisos                              | Dos esquemas de identidad y sesión                    |
| Administración / Configuración        | `Frontend/ADMINISTRACION/Configuracion`                         | `Backend/ADMINISTRACION/Configuracion`                                      | `settings`, `audit_log`                                                   | SMTP y Google Calendar       | Correo, documentos, agenda, retención            | Configuración global con secretos                     |
| Usuarios y permisos                   | `Frontend/ADMINISTRACION/Usuarios`                              | `Backend/ADMINISTRACION/Usuarios`                                           | `staff_users`, `audit_log`                                                | Ninguna directa              | Todas las rutas y bootstrap                      | Autorización granular y compatibilidad heredada       |
| Agenda                                | `Frontend/AGENDA/Agenda_general`                                | `Backend/AGENDA/Agenda_general`                                             | `appointments`, `agenda_availability_rules`, propietarios/pacientes       | SMTP                         | Propietarios, pacientes, usuarios, controles     | Reglas temporales y conflictos globales               |
| Reservas                              | `Frontend/AGENDA/Reservas`                                      | `Backend/AGENDA/Reservas`                                                   | Compartida con propietarios, pacientes y citas                            | Ninguna directa              | Agenda y pacientes placeholder                   | Orquestación entre múltiples entidades                |
| Google Calendar                       | `Frontend/AGENDA/Integracion_Google`                            | `Backend/AGENDA/Integracion_Google`                                         | Archivos de credenciales/token; citas                                     | OAuth y Calendar API         | Agenda, URL pública, configuración               | Integración externa con estado OAuth                  |
| Propietarios                          | `Frontend/CONSULTORIO/Pacientes/Propietarios`                   | `Backend/CONSULTORIO/Pacientes/Propietarios`                                | `owners`, múltiples tablas dependientes                                   | Ninguna directa              | Pacientes, agenda, clínica, peluquería, ventas   | CRUD con unicidad parcial y borrado en cascada        |
| Pacientes                             | `Frontend/CONSULTORIO/Pacientes/COMPARTIDO`                     | `Backend/CONSULTORIO/Pacientes/COMPARTIDO`                                  | `patients`, `patient_status_events`, `patient_weight_records`             | Archivos de imagen           | Propietarios y todos los módulos clínicos        | Entidad central con estado longitudinal               |
| Historia clínica                      | `Frontend/CONSULTORIO/Pacientes/Historia_clinica`               | `Backend/CONSULTORIO/Pacientes/Historia_clinica`                            | `clinical_records`, `clinical_evolutions`, `audit_log`                    | PDF                          | Paciente, propietario, consultas                 | Lógica clínica compleja y retención                   |
| Consultas                             | `Frontend/CONSULTORIO/Pacientes/Consultas`                      | `Backend/CONSULTORIO/Pacientes/Consultas`                                   | `clinical_consultations`, pesos, recordatorios, seguimientos              | Email/archivos según subtipo | Historia, paciente, agenda, documentos           | Lógica clínica polimórfica y transacciones cruzadas   |
| Vacunas                               | `Frontend/CONSULTORIO/Pacientes/Vacunas`                        | `Backend/CONSULTORIO/Pacientes/Vacunas`                                     | Consulta compartida y campos de `patients`                                | Ninguna directa              | Consultas, controles, paciente                   | Reglas clínicas sobre entidad compartida              |
| Desparasitaciones                     | `Frontend/CONSULTORIO/Pacientes/Desparasitaciones`              | `Backend/CONSULTORIO/Pacientes/Desparasitaciones`                           | Consulta compartida y campos de `patients`                                | Ninguna directa              | Consultas, controles, paciente                   | Reglas clínicas sobre entidad compartida              |
| Control                               | `Frontend/CONSULTORIO/Pacientes/Control`                        | `Backend/CONSULTORIO/Pacientes/Control`                                     | `control_reminders`, consultas y citas                                    | SMTP                         | Consulta, agenda, propietario                    | Programación y notificación                           |
| Seguimientos                          | `Frontend/SEGUIMIENTOS`                                         | `Backend/SEGUIMIENTOS`                                                      | `clinical_followups`, consultas                                           | SMTP; job HTTP               | Paciente, consulta, historia                     | Series temporales y automatización                    |
| Hospitalización / Ambulatorio         | `Frontend/CONSULTORIO/Pacientes/Hospitalizaciones_ambulatorios` | `Backend/CONSULTORIO/Pacientes/Hospitalizaciones_ambulatorios`              | Consulta compartida con JSON                                              | Documentos clínicos          | Consultas, historia, paciente                    | Lógica clínica compleja en payload flexible           |
| Cirugías / Procedimientos / Anestesia | `Frontend/CONSULTORIO/Pacientes/Cirugias_procedimientos`        | `Backend/CONSULTORIO/Pacientes/Cirugias_procedimientos`                     | Consulta compartida con JSON                                              | PDF                          | Consultas, historia, documentos                  | Lógica clínica y generación documental                |
| Ayudas diagnósticas                   | `Frontend/CONSULTORIO/Pacientes/Ayudas_diagnosticas`            | `Backend/CONSULTORIO/Pacientes/Ayudas_diagnosticas`                         | Consulta compartida y adjuntos                                            | Archivos embebidos/streaming | Consultas, exámenes                              | Datos semiestructurados y adjuntos                    |
| Exámenes                              | `Frontend/CONSULTORIO/Examenes`                                 | `Backend/CONSULTORIO/Examenes`                                              | Consulta compartida                                                       | Archivos embebidos/streaming | Consultas, ayudas diagnósticas                   | Fusión de registros y adjuntos                        |
| Fórmulas médicas                      | `Frontend/CONSULTORIO/Pacientes/Formulas_medicas`               | `Backend/CONSULTORIO/Pacientes/Formulas_medicas`                            | Consulta compartida                                                       | PDF                          | Consultas, paciente, configuración               | Generación documental clínica                         |
| Documentos y firmas                   | `Frontend/CONSULTORIO/Pacientes/Documentos`                     | `Backend/CONSULTORIO/Pacientes/Documentos`                                  | `clinical_consultations`, `document_signature_requests`, `audit_log`      | SMTP, PDF, DOCX              | Paciente, propietario, historia                  | Generación documental y firma remota                  |
| Consentimientos                       | Vistas compartidas de Documentos y Peluquería                   | `Backend/CONSULTORIO/Pacientes/Documentos`                                  | `consents` y documentos clínicos sintéticos                               | SMTP/PDF/firma               | Consultas, peluquería, propietario               | Evidencia clínica y generación documental             |
| Remisiones                            | `Frontend/CONSULTORIO/Pacientes/Remisiones`                     | `Backend/CONSULTORIO/Pacientes/Remisiones`                                  | Consulta compartida                                                       | PDF                          | Historia, paciente, consulta                     | Generación documental clínica                         |
| Peluquería                            | `Frontend/CONSULTORIO/Peluqueria`                               | `Backend/CONSULTORIO/Peluqueria`                                            | `grooming_documents`; consultas/firma para consentimiento                 | SMTP, PDF, firma             | Propietarios, pacientes, documentos              | Múltiples entidades y consentimiento                  |
| Ventas compartido / POS               | `Frontend/VENTAS/COMPARTIDO`                                    | `Backend/VENTAS/COMPARTIDO`                                                 | Clientes, documentos, pagos, catálogo, caja                               | SMTP/PDF                     | Precios, inventario, facturación, caja           | Orquestación financiera transversal                   |
| Precios y catálogo                    | `Frontend/VENTAS/Precios`                                       | `Backend/VENTAS/Precios`                                                    | `billing_catalog_categories`, `billing_catalog_items`                     | Imágenes de producto         | Proveedores, inventario, ventas                  | Catálogo con archivado y restauración                 |
| Vencimientos                          | `Frontend/VENTAS/Vencimientos`                                  | `Backend/VENTAS/Vencimientos`                                               | Lecturas de catálogo/lotes representados                                  | Ninguna directa              | Inventario, precios                              | Proyección sobre inventario; modelo propio limitado   |
| Cotizaciones                          | `Frontend/VENTAS/Cotizacion`                                    | `Backend/VENTAS/Cotizacion`                                                 | `billing_documents` y `billing_document_items`                            | PDF/email compartidos        | Clientes, catálogo                               | Documento financiero sin efectos de stock/caja        |
| Facturación                           | `Frontend/VENTAS/Facturacion`                                   | `Backend/VENTAS/Facturacion`                                                | Documentos, líneas, pagos, stock y caja                                   | SMTP, PDF                    | Inventario, caja, clientes                       | Transacciones financieras y reconstrucción de efectos |
| Pagos                                 | Lógica dentro de Facturación/Compartido                         | `Backend/VENTAS/Facturacion`                                                | `billing_document_payments`, `billing_cash_movements`                     | PDF                          | Facturación y caja                               | Transacción financiera con saldo derivado             |
| Inventario                            | `Frontend/VENTAS/Inventario`                                    | `Backend/VENTAS/Inventario`                                                 | `billing_stock_movements`, `billing_physical_counts`, catálogo            | PDF                          | Facturas, compras, precios                       | Kardex, conteos y consistencia de existencias         |
| Proveedores y compras                 | Vistas dentro de Inventario/Compartido                          | `Backend/VENTAS/Inventario`                                                 | `billing_providers`, `billing_purchases`, `billing_purchase_items`, stock | Ninguna directa              | Catálogo, inventario, cierres                    | Transacciones de compra y reversión                   |
| Caja                                  | `Frontend/VENTAS/Caja`                                          | `Backend/VENTAS/Caja`                                                       | Movimientos, sesiones, préstamos de socios                                | PDF indirecto                | Facturas, pagos, compras, cierres                | Transacciones financieras, arqueos y reversos         |
| Informes clínicos                     | `Frontend/INFORMES/Clinicos`                                    | `Backend/INFORMES/Clinicos`                                                 | Lecturas agregadas y `audit_log`                                          | Ninguna directa              | Casi todos los dominios                          | Agregación amplia de datos sensibles                  |
| Informes financieros / cierres        | `Frontend/INFORMES/Financieros`                                 | `Backend/INFORMES/Financieros`                                              | `billing_month_closures` y datos financieros                              | PDF                          | Facturación, caja, inventario, compras           | Cálculo financiero y snapshots invalidables           |
| Backup y reinicio administrativo      | UI de administración/compartido                                 | `Backend/BASE_DE_DATOS/rutas.py`; `COMPARTIDO/Inicio`                       | Copia SQLite; `administrative_reset_backups`                              | Sistema de archivos          | Todos los dominios                               | Operaciones destructivas y recuperación               |

## Contrato técnico común

Los módulos con backend completo suelen exponer `rutas.py`, `servicios.py`, `validacion.py` y `persistencia.py`. Los submódulos clínicos y de ventas que representan un “tipo” —vacunas, desparasitaciones, hospitalización, cotización, vencimientos— pueden limitarse a reglas o UI y delegar las rutas/persistencia a Consultas o Ventas compartido. Esta delegación debe conservarse conceptualmente o reemplazarse por contratos explícitos; crear una tabla por pantalla sin entender el modelo polimórfico alteraría el comportamiento.

## Detalle por módulo

### Inicio / Dashboard

- **Archivos principales:** `Frontend/COMPARTIDO/Inicio/{Vistas,Logica,Estilos}` y `Backend/COMPARTIDO/Inicio`.
- **HTTP:** los datos llegan principalmente por `GET /api/bootstrap`; no hay una ruta de dashboard independiente.
- **Servicios/validación:** resumen generado desde la base; la presentación y filtros son mayormente frontend.
- **Persistencia/tablas:** conteos y listas de propietarios, pacientes, citas, consultas, peluquería y ventas.
- **Comportamiento:** tarjetas y accesos de resumen operativo.
- **Documentos:** ninguno propio.
- **Riesgo:** reproducir solo métricas visibles omitiría los filtros por permisos y la dependencia del bootstrap.

### Autenticación

- **Archivos principales:** `Frontend/COMPARTIDO/Autenticacion/Logica/interfaz.js`, `Backend/COMPARTIDO/Autenticacion/rutas.py`, `Backend/COMPARTIDO/Rutas/web.py`.
- **HTTP:** `GET /api/auth/status`, `POST /api/auth/login`, `POST /api/auth/logout`.
- **Servicios/validación:** comparación del administrador de entorno o `authenticate_user`; no hay esquema dedicado de validación de login.
- **Persistencia:** `staff_users`; sesión firmada en cookie.
- **Comportamiento:** login opcional según configuración y opción “recordarme”.
- **Riesgo:** modo fail-open, sesiones largas, dos orígenes de identidad y falta de revocación.

### Configuración

- **Archivos principales:** `Backend/ADMINISTRACION/Configuracion/{rutas,servicios,validacion,persistencia}.py` y su carpeta frontend homóloga.
- **HTTP:** `POST /api/settings`; lectura por bootstrap.
- **Persistencia:** `settings`, `audit_log`.
- **Reglas:** normaliza puertos, booleanos, timezone, plantillas y datos SMTP; conserva contraseña SMTP si llega vacía.
- **Integraciones:** controla correo y Google; aporta identidad visual/legal a documentos.
- **Riesgo:** configuración global no separada por tenant y auditoría de valores sensibles.

### Usuarios y permisos

- **Archivos principales:** `Usuarios/{rutas,servicios,validacion,persistencia,permisos,autorizacion}.py` y UI de administración.
- **HTTP:** `POST /api/users`, `DELETE /api/users/<id>`; lectura por bootstrap.
- **Persistencia:** `staff_users`, `audit_log`.
- **Validación:** correo obligatorio, rol, matrícula obligatoria para veterinario, permisos reconocidos y contraseña solo obligatoria al crear.
- **Comportamiento:** CRUD, perfiles por recurso/acción y selector de profesionales.
- **Riesgo:** perfiles heredados evaden autorización granular; `is_active` no se aplica; cambio de clave no revoca sesiones.

### Agenda, disponibilidad y reservas

- **Archivos principales:** `AGENDA/Agenda_general` y `AGENDA/Reservas` en ambas capas.
- **HTTP:** crear cita/disponibilidad; borrar disponibilidad/cita; actualizar estado/observaciones; enviar recordatorio.
- **Persistencia:** `appointments`, `agenda_availability_rules`, propietarios y pacientes placeholder para reserva.
- **Validación:** duración y slot entre 15 y 240 minutos; fin posterior al inicio; alineación a reglas configuradas.
- **Comportamiento:** calendario, sala de espera, confirmación/cancelación y reservas rápidas.
- **Integraciones:** SMTP y Google Calendar.
- **Riesgo:** cualquier cita activa bloquea a cualquier otra aunque cambien profesional o ubicación; confirmar intención.

### Google Calendar

- **Archivos principales:** `Backend/AGENDA/Integracion_Google/{rutas,google_calendar}.py` y UI homóloga.
- **HTTP:** configurar, conectar, desconectar, consultar ocupación, sincronizar asistencia y callback OAuth.
- **Persistencia:** `credentials.json`, `token.json`, configuración y citas.
- **Comportamiento:** autorización OAuth, lectura de busy slots y sincronización.
- **Riesgo:** almacenamiento local global, confianza en host externo y modelo OAuth no diseñado por tenant.

### Propietarios

- **Archivos principales:** `Propietarios/{rutas,servicios,validacion,persistencia}.py` y UI homóloga.
- **HTTP:** `POST /api/owners`, `DELETE /api/owners/<id>` y variante POST de borrado.
- **Persistencia:** `owners` más borrado manual en tablas clínicas, agenda, peluquería y ventas.
- **Validación:** nombre; identificación/contacto opcionales; unicidad parcial de identificación cuando existe.
- **Comportamiento:** alta/edición, búsqueda y relación uno-a-muchos con pacientes.
- **Riesgo:** el borrado físico es una cascada de dominio extensa; no trasladarlo como un DELETE simple.

### Pacientes

- **Archivos principales:** `Pacientes/COMPARTIDO/{rutas,servicios,validacion,persistencia}.py` y frontend compartido.
- **HTTP:** guardar, foto, cambiar estado clínico y borrar por DELETE/POST.
- **Persistencia:** `patients`, `patient_status_events`, `patient_weight_records` y dependencias clínicas.
- **Validación:** propietario existente; peso positivo cuando se informa; duplicado por propietario+nombre se controla en servicio, no constraint.
- **Comportamiento:** ficha, foto, peso actual, prevención, activo/fallecido y reactivación.
- **Riesgo:** marcar fallecido cancela pendientes; borrar ejecuta cascada física; fotos/base64 requieren nueva política de storage.

### Historia clínica

- **Archivos principales:** `Historia_clinica/{rutas,servicios,validacion,persistencia,clinical_exports}.py`.
- **HTTP:** guardar/finalizar historia, generar PDF, borrar; evoluciones por `POST /api/clinical-evolutions`.
- **Persistencia:** `clinical_records`, `clinical_evolutions`, consultas y auditoría.
- **Reglas:** una historia finalizada no se edita; las evoluciones sí se anexan y extienden retención.
- **Comportamiento:** expediente longitudinal con PDF.
- **Riesgo:** retención, inmutabilidad, sincronización con primera consulta y cascadas no son un CRUD normal.

### Consultas y subtipos clínicos

- **Archivos principales:** `Consultas/{rutas,servicios,validacion,persistencia}.py`; carpetas Vacunas, Desparasitaciones, Hospitalizaciones, Cirugías, Ayudas, Exámenes, Fórmulas, Control y Remisiones.
- **HTTP:** guardar/obtener/borrar consulta, servir adjunto; rutas de exportación según subtipo.
- **Persistencia:** `clinical_consultations` con `document_reference` semiestructurado; pesos, recordatorios, seguimientos y citas derivadas.
- **Validación:** allowlist de tipos, historia/paciente existentes, consentimiento compatible y peso positivo.
- **Comportamiento:** formularios distintos por tipo sobre un registro genérico; exámenes de laboratorio pendientes pueden fusionarse.
- **Documentos:** PDF de fórmula, remisión, anestesia, cirugía, historia; adjuntos embebidos y URLs de streaming.
- **Riesgo:** buena parte del esquema de cada subtipo vive en JavaScript/JSON. Debe inventariarse campo por campo antes de normalizar.

### Control y seguimientos

- **Archivos principales:** `Pacientes/Control`, `Backend/SEGUIMIENTOS` y `Frontend/SEGUIMIENTOS`.
- **HTTP:** completar seguimiento y `GET /api/jobs/control-reminders`; creación se deriva de consultas.
- **Persistencia:** `control_reminders`, `clinical_followups`, citas y consultas sintéticas de seguimiento.
- **Reglas:** series por días/semanas/meses con máximo de 120; solo pendientes se regeneran; pacientes fallecidos se omiten.
- **Comportamiento:** tablero, envío de correo, resultado y próxima tarea.
- **Riesgo:** job público si falta secreto; fecha/límite controlables; completar seguimiento también altera historia.

### Documentos, consentimientos y firmas

- **Archivos principales:** `Pacientes/Documentos/{rutas,servicios,persistencia}.py`, `clinical_documents.py`, `sign.js/sign.html` y UI.
- **HTTP:** PDF/DOCX de documento; obtener solicitud por token; enviar código; firmar; guardar consentimiento; página `/firmar/<token>`.
- **Persistencia:** consultas, `consents`, `document_signature_requests`, auditoría y JSON de evidencia.
- **Reglas:** enlace de siete días; código de seis dígitos por quince minutos; cinco intentos; hash de versión del documento.
- **Comportamiento:** edición/generación, email, vista pública y firma manuscrita.
- **Riesgo:** HTML almacenado se inserta en una página pública; reenvío y tamaño de firma no tienen cuotas; datos legales requieren validación humana.

### Peluquería

- **Archivos principales:** `CONSULTORIO/Peluqueria/{rutas,servicios,validacion,persistencia}.py` y UI.
- **HTTP:** guardar, detalle/estados de firma, enviar consentimiento, borrar, PDFs de ingreso y consentimiento.
- **Persistencia:** `grooming_documents` y, para consentimiento, consulta/firma clínica sintética.
- **Validación:** acepta cliente vinculado o independiente, exige nombre de mascota y estados/rabia permitidos.
- **Comportamiento:** ingreso, servicios, fotos antes/después, estado, certificado y consentimiento.
- **Riesgo:** borrar puede eliminar el documento clínico y firmas vinculadas; JSON/fotos requieren storage y esquema explícito.

### Precios, catálogo y vencimientos

- **Archivos principales:** `VENTAS/Precios`, `VENTAS/Vencimientos` y `VENTAS/COMPARTIDO`.
- **HTTP:** guardar/borrar/restaurar categorías e ítems, obtener imagen; vencimientos se alimenta del bootstrap.
- **Persistencia:** categorías, ítems, proveedor, cantidades, coste/precio, margen e imagen.
- **Reglas:** normalización de categorías, redondeos de precio y archivado/restauración.
- **Comportamiento:** catálogo, imágenes, filtros y proyección de productos próximos a vencer.
- **Riesgo:** vencimientos no tienen una entidad de lote robusta; aclarar si fecha por producto basta en el SaaS.

### Cotización, facturación y pagos

- **Archivos principales:** `VENTAS/Cotizacion`, `VENTAS/Facturacion`, `VENTAS/COMPARTIDO` y backend homólogo.
- **HTTP:** crear/editar/borrar/obtener documento, PDF/email; crear/borrar pago y PDF.
- **Persistencia:** `billing_clients`, `billing_documents`, líneas, pagos, stock y caja.
- **Validación:** totales no negativos, cliente/paciente compatibles, desglose mixto exacto y pagos hasta el saldo.
- **Comportamiento:** POS, cotización o factura, envío/impresión, abonos y saldo.
- **Riesgo:** factura impacta inventario y caja en una sola transacción; editar revierte y reconstruye; cotización no produce efectos.

### Inventario, proveedores y compras

- **Archivos principales:** `VENTAS/Inventario/{rutas,servicios,validacion,persistencia,exports}.py` y frontend.
- **HTTP:** proveedores; ajustes individuales/masivos; conteo físico; compras CRUD; limpiar rango; PDF de inventario.
- **Persistencia:** proveedores, catálogo, movimientos, conteos, compras y líneas.
- **Reglas:** facturas bloquean stock negativo; ajustes manuales y algunas reversiones no; compra puede afectar o no inventario; descuento es global.
- **Comportamiento:** kardex, ajustes, conteo físico, compras y reporte.
- **Riesgo:** inconsistencias permitidas son parte del comportamiento actual; las rutinas automáticas de reset no deben migrarse.

### Caja

- **Archivos principales:** `VENTAS/Caja/{rutas,servicios,validacion,persistencia}.py` y frontend.
- **HTTP:** movimientos, transferencia, borrado/reclasificación, apertura/arqueo/cierre/reapertura, resets y aportes/reintegros de socios.
- **Persistencia:** `billing_cash_movements`, `billing_cash_sessions`, `billing_partner_loans`, pagos/documentos relacionados.
- **Reglas:** saldo esperado = base + ingresos − egresos; movimientos posteriores a cierre se anulan y compensan, no se borran; movimientos automáticos tienen restricciones.
- **Comportamiento:** tres cuentas fijas, turnos, arqueos, transferencias y préstamos.
- **Riesgo:** contabilidad basada en convenciones y movimientos pareados; existe una migración con corrección productiva específica.

### Informes y cierres

- **Archivos principales:** `INFORMES/Clinicos`, `INFORMES/Financieros` y frontend homólogo.
- **HTTP:** reporte de ventas, PDF, listar/previsualizar/crear/obtener cierre y PDF.
- **Persistencia:** lecturas de todo el dominio, `audit_log`, `billing_month_closures`.
- **Reglas:** cierre almacena snapshot; una mutación posterior elimina/invalida cierres afectados.
- **Comportamiento:** métricas clínicas/financieras y cierres mensuales.
- **Riesgo:** “reports” devuelve colecciones anidadas que el filtro de permisos no depura; snapshot no equivale a período contablemente bloqueado.

### Backups y reset administrativo

- **Archivos principales:** `Backend/BASE_DE_DATOS/rutas.py`, `database.py`, `Backend/COMPARTIDO/Inicio`.
- **HTTP:** `POST /api/backups` y `POST /api/admin/delivery-reset`.
- **Persistencia:** backup de archivo SQLite, `administrative_reset_backups`, borrado multi-tabla.
- **Comportamiento:** respaldo local y reinicio controlado del entorno de entrega.
- **Riesgo:** PostgreSQL no tiene backup desde la app; los resets requieren autorización extensa y no tienen lugar en un producto multi-tenant sin rediseño.
