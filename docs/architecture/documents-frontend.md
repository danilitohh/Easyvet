# Frontend de documentos y consentimientos

## Rutas y ubicación

La lista documental es una sección de la historia del Patient con URL propia; los
Consent tienen listado, creación/edición Draft y detalle con rutas deep-linkables.
La página pública `/firmar/:token` funciona sin sesión. Los detalles clínicos
elegibles exponen acciones de generar PDF y enlazan al documento/historia. La ruta
interna carga módulos de forma lazy y toda navegación conserva tenant actual.

## Acciones y estados

Documentos: lectura/paginación y filtros, generación habilitada por permiso/source,
upload de PDF/PNG/JPEG, descarga, confirmación de void y estado histórico visible.
Consent: lista, Draft incompleto guardable, edición optimista por `expectedVersion`,
issue con resumen de contexto, modal de link/código temporal, reissue explícito,
estado signed read-only, void y acceso al PDF firmado. El secreto one-time se limpia
al cerrar el modal y no se recupera desde el detalle.

La página pública presenta el snapshot emitido y la advertencia legal discreta; no
expone tenant IDs, IDs clínicos ni documento completo del responsable. Acepta firma
typed o captura drawn con fallback typed y muestra errores públicos genéricos.
Campos con labels, instrucciones/errores asociados y estados de loading/disabled
mantienen teclado y lectores de pantalla; los targets de dibujo tienen alternativa.

## Responsive y tenant switching

Los estilos reorganizan filas/acciones debajo de 720 px, manejan formularios en una
columna y admiten movimiento reducido. El componente limpia/oculta metadatos viejos
al cambiar tenant mientras la nueva consulta está pending o falla; la autorización
backend sigue siendo la barrera de seguridad. La suite de componentes prueba lista,
upload, modales de secreto, Draft, issue/reissue, signed state, página pública, typed,
drawn, error de token y cambio de tenant. Para declarar QA manual a 390 px hace falta
un viewport medido en browser; inspección CSS o tests DOM no equivalen a esa prueba.
