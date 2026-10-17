# Easyvet — inventario técnico de datos y privacidad

**Estado:** inventario interno de ingeniería; no es un aviso de privacidad, política de cookies ni dictamen de cumplimiento.  
**Revisado:** 2026-10-16  
**Jurisdicción indicada por el propietario del producto:** Colombia.

Este documento registra lo que se observa en el código y la configuración versionada. No confirma qué variables están configuradas en producción, los contratos con proveedores, la ubicación efectiva de los datos ni la base jurídica del tratamiento. Debe revisarse antes de publicar textos legales.

## Datos que el producto solicita o puede almacenar

| Grupo                        | Datos observables en el modelo/código                                                                                                                    | Uso funcional                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Cuenta                       | Correo, hash de contraseña, estado y rol de plataforma. El registro también solicita nombre visible, clínica, correo y contraseña.                       | Identificación, autenticación, creación de organización y control de acceso.                                                |
| Organización y equipo        | Nombre y configuración de la clínica; vínculos usuario-organización, roles y perfiles profesionales.                                                     | Separación multi-tenant, operación y permisos.                                                                              |
| Tutores/responsables         | Nombre, tipo y número de documento, correo, teléfonos, dirección, ciudad y notas.                                                                        | Identificación del responsable del paciente, comunicaciones y operación clínica/comercial.                                  |
| Pacientes animales           | Nombre, especie, raza, sexo, fecha de nacimiento, color, microchip, peso, esterilización y notas.                                                        | Identificación y atención veterinaria.                                                                                      |
| Operación clínica            | Citas, historia, evoluciones, mediciones, diagnósticos, procedimientos, anestesia, hospitalización, fórmulas, vacunas, desparasitaciones y seguimientos. | Prestación y continuidad de la atención veterinaria.                                                                        |
| Documentos y consentimientos | Archivos PDF/PNG/JPEG, título, nombre original, tipo, tamaño y hash; texto del consentimiento, snapshots de identidad, firma y evidencia.                | Adjuntar evidencia clínica y conservar el ciclo de consentimiento.                                                          |
| Evidencia de firma           | Hash del token y OTP, nombre del firmante, método/firma, fecha, hash de evidencia, IP y user-agent.                                                      | Verificar y auditar una firma pública.                                                                                      |
| Operación comercial          | Ventas, pagos registrados, facturas, cajas, inventario y eventos de auditoría relacionados.                                                              | Administración operativa de la clínica. El inventario de código no confirma integración con un procesador de pagos externo. |
| Seguridad y auditoría        | Hashes de tokens de sesión/acción, vencimiento, revocación, membresía activa, intentos de firma y eventos de auditoría.                                  | Sesiones, recuperación/verificación, autorización e investigación de acciones.                                              |

Fuentes principales: `apps/api/src/auth/auth.dto.ts`, `apps/api/src/auth/account-lifecycle.service.ts`, `apps/api/src/auth/password.service.ts`, `apps/api/src/auth/session-cookie.service.ts` y los modelos `User`, `Organization`, `Membership`, `Owner`, `Patient`, `ClinicalDocument`, `Consent` y `ConsentSignatureRequest` de `prisma/schema.prisma`.

## Almacenamiento y terceros observables

- **Base de datos:** PostgreSQL vía `DATABASE_URL` (en el entorno desplegado se conecta el proyecto Supabase configurado por el propietario). No se incluye aquí la cadena de conexión ni se infiere el rol efectivo de Prisma.
- **Archivos clínicos:** adaptador local, S3 compatible o Supabase Storage. En Vercel, si `STORAGE_DRIVER` no se especifica, `apps/api/src/config/env.ts` selecciona Supabase; las variables reales de Production no se verificaron en esta revisión. El bucket configurado debe ser privado y sus políticas/ubicación requieren verificación en Supabase.
- **Alojamiento:** Vercel, según el despliegue del proyecto. Revisar contrato, región, logs y retención con la configuración de la cuenta.
- **Correo:** el servicio puede enviar verificación y recuperación por Resend cuando `RESEND_API_KEY` y `RESEND_FROM_EMAIL` están configuradas. El código envía a ese proveedor el correo destinatario y el contenido/enlace transaccional. No se verificó si esas variables están activas en producción.
- **Analítica/SDK de medición:** la web integra `@vercel/analytics` detrás de una decisión explícita de consentimiento guardada en `localStorage`. Solo mide rutas y navegación en producción; `beforeSend` elimina query/hash, reemplaza UUIDs por `:id` y descarta `/firmar/*`. No se envían datos clínicos, identificadores de pacientes ni tokens. Vercel Web Analytics no usa cookies de terceros según su documentación; la configuración efectiva del proyecto debe verificarse en Vercel.
- **Cookie de sesión Easyvet:** cookie `easyvet_session` por defecto; `HttpOnly`, `Secure` en producción, `SameSite=Lax`, `Path=/`; duración predeterminada de 168 horas, configurable por entorno. La sesión es necesaria para autenticación.

## Hallazgos y pendientes previos a avisos públicos

1. Las políticas de privacidad, términos, cookies y reembolsos están disponibles como páginas de la aplicación, pero sus datos del responsable legal siguen pendientes y requieren revisión profesional antes de publicarse como versión final.
2. El consentimiento de analítica opcional está implementado en el cliente con opción de aceptar, rechazar y gestionar preferencias. La base jurídica, retención, transferencia y condiciones del proveedor deben validarse para Colombia antes del lanzamiento comercial.
3. La analítica integrada es básica y agregada; no incluye todavía embudos, exportaciones ni eventos de negocio detallados. No deben añadirse nuevos eventos que incluyan datos clínicos, identificadores o tokens.
4. No se identificó una ruta pública o procedimiento de autoservicio para solicitudes de titulares, rectificación, consulta, eliminación o exportación; confirmar el procedimiento operativo y sus excepciones de conservación antes de prometerlo.
5. No se encontró una regla uniforme de retención/eliminación para cuentas, datos clínicos, documentos, evidencia de firma, auditorías y respaldos. Definirla con asesoría legal y clínica antes de publicar plazos.
6. La identidad legal/razón social, NIT, correo de soporte y dirección fueron reportados como **pendientes** por el propietario. No completar con datos inventados.
7. El propietario indicó para reembolsos: “sin reembolsos, sujeto a ley”. No publicar una exclusión absoluta: redactar condiciones y excepciones con revisión jurídica de Colombia, teniendo en cuenta el producto, la suscripción y los derechos legales aplicables.
8. Precios y descuento anual de suscripción siguen por definir; no presentar tarifas o condiciones como finales sin validación comercial.

## Próxima revisión requerida

Antes de publicar documentos legales, confirmar: (a) identidad y datos de contacto del responsable, (b) configuración efectiva de base, bucket, correo, regiones y proveedores en producción, (c) propósitos, bases aplicables, destinatarios/encargados y transferencias, (d) retención y procedimiento para solicitudes de titulares, (e) condiciones reales de suscripción/cancelación/reembolso. Someter los textos a revisión profesional en Colombia. Este inventario por sí solo no acredita cumplimiento.
