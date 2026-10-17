# Easyvet V1 — limitaciones conocidas

Este documento concentra lo excluido o no verificado en V1; no representa módulos implementados pendientes.

| Área                           | Límite conocido                                                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clínica                        | Flujos clínicos internos disponibles; no incluye importación/migración automatizada de expedientes legacy ni integraciones de laboratorio/imagen externos.                                               |
| Notificaciones                 | Seguimientos y recordatorios internos; no se envían email, SMS, WhatsApp o push desde un proveedor.                                                                                                      |
| Documentos y firmas            | Flujo de consentimientos y firma pública por token implementado. En Vercel se configuró Supabase Storage privado y se comprobó el bucket; aún falta probar carga/descarga autorizada con un archivo sintético. No se verificó entrega de correo/SMS externa. |
| Grooming                       | Flujo de atención interno, sin agenda de reservas pública ni integraciones de terceros.                                                                                                                  |
| Inventario / compras           | Catálogo, lotes, sedes y ledger interno disponibles; compras, proveedores y abastecimiento automatizado no forman parte de V1.                                                                           |
| Comercial / fiscal             | Ventas, pagos registrados, facturas internas y caja disponibles; sin proveedor fiscal/electrónico, pasarela de pago ni motor externo de reembolsos.                                                      |
| Autenticación / administración | Sesiones y permisos organizacionales implementados; MFA, SSO, roles personalizados y entrega automatizada de invitaciones no están incluidos.                                                            |
| Informes                       | Informes internos agregados y analítica básica opcional de navegación; no hay exportación CSV/PDF, embudos ni analítica avanzada.                                                                         |
| Integraciones                  | Google Calendar, laboratorios externos, mensajería, pagos/fiscalidad y APIs de terceros están fuera de alcance.                                                                                          |
| Móvil                          | Web responsive; no hay aplicación nativa ni operación offline.                                                                                                                                           |
| Rendimiento / operaciones      | No se ejecutó prueba de carga ni se validó producción. La API es un monolito modular; despliegue, observabilidad externa, backups y recuperación dependen de la futura operación.                        |
| Dependencias                   | `npm audit` mantiene 19 vulnerabilidades moderadas de tooling de pruebas y ninguna alta/crítica; no se aplicó un upgrade major incompatible. Ver [revisión de seguridad](../security/v1-security-review.md). |
| Revisión independiente         | No se completó un pentest/escaneo profundo externo; el helper local de revisión no pudo iniciar por su runtime.                                                                                          |

Las limitaciones no deben resolverse agregando integraciones o módulos dentro del cierre V1. Requieren una solicitud y autorización separadas.

Los fixtures mock que usan algunas páginas solo pueden activarse en desarrollo; la configuración de producción fuerza el modo API aunque el build reciba `VITE_DATA_MODE=mock`.
