# Inventory frontend

El módulo es una ruta lazy `/inventario` integrada en el shell existente; las
rutas semánticas `/inventario/nuevo`, `/inventario/:itemId` y
`/inventario/:itemId/editar` permiten acceso directo y recarga. El sidebar solo
muestra Inventario con `inventory.read`; cada route y acción de escritura valida
su permiso correspondiente además de la autorización de backend.

El dashboard combina catálogo con contadores operativos. El filtro de sede
declara de forma visible `Todas las sedes` cuando agrega saldos organizacionales;
seleccionar una sede limita la cantidad y el bajo mínimo a esa ubicación. El
mínimo se explica como umbral único por artículo aplicado en cada sede. Lista de
escritorio y tarjetas móviles muestran artículo, tipo, unidad, cantidad, mínimo,
lotes y estado con texto y color redundantes.

La ficha consulta metadata, stock derivado, lotes/vencimiento, sedes y los diez
movimientos recientes. El ledger es solo lectura; las entradas/salidas/corrección
se muestran con signo evidente y cada compensación crea una fila nueva. Crear y
editar Items no muta stock. El archivo solicita confirmación y queda deshabilitado
si la proyección total no es cero.

Los diálogos aceptan cantidad positiva, sede activa y timestamp con offset
producido por el browser. Recepción puede elegir/crear lote en el mismo diálogo,
incluyendo fechas vencidas para documentar inventario real. Ajuste pregunta por
aumentar/disminuir; traslado elige origen/destino distintos y muestra saldo
disponible, pero el servidor vuelve a validar bajo locks. `INSUFFICIENT_STOCK`
actualiza lecturas, explica el conflicto y no reintenta.

`useInventoryResource` asocia cada lectura a tenant y query, aborta en cleanup y
no representa resultado de otra Organization mientras cambia el contexto. Las
mutaciones se cancelan al desmontar/cambiar de tenant; formularios, filtros y
diálogos se remontan bajo la clave Organization/item para descartar estado
anterior. Todo texto es contenido React normal, no HTML interpretado.

La grilla usa tabla semántica en escritorio y tarjetas en teléfono; CSS del módulo
mantiene anchos mínimos controlados y cambia layout bajo 760/480px. Labels están
asociados a inputs, los estados no dependen solo del color y las operaciones usan
el Modal común con Escape, cierre de overlay y devolución de foco.
