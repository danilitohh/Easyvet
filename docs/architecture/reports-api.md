# Reports API (Fase 10)

Todas las rutas requieren sesión, Organization activa y el permiso específico.
El tenant se deriva de `TenantContext`; el cliente no envía `organizationId`.

| Método y ruta                     | Permiso                    | Respuesta                                                |
| --------------------------------- | -------------------------- | -------------------------------------------------------- |
| `GET /api/v1/reports/operational` | `reports.operational.read` | Citas, seguimientos, peluquería, hospitalización         |
| `GET /api/v1/reports/clinical`    | `reports.clinical.read`    | Conteos de evidencia clínica finalizada                  |
| `GET /api/v1/reports/commercial`  | `reports.commercial.read`  | Ventas, descuentos, pagos, facturas y cierres por moneda |
| `GET /api/v1/reports/inventory`   | `reports.inventory.read`   | Catálogo, alertas de stock/lote y movimientos            |

Query común opcional:

- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `clinicLocationId=<UUID>`

El rango predeterminado son 30 días inclusive en la zona Organization y no puede
superar 366 días. Una sede ajena al tenant responde `404 LOCATION_NOT_FOUND`.
Fechas inválidas o invertidas responden `400 INVALID_REPORT_RANGE`. Respuestas
solo contienen agregados; montos `DECIMAL` son strings y permanecen separados
por moneda. El API no expone Patient/Owner, listas, narrativas clínicas ni CSV/PDF.

Los permisos mínimos concedidos por rol se documentan en
[`authorization.md`](authorization.md); OWNER y ADMIN reciben los cuatro,
RECEPTION y PRACTITIONER pueden recibir operacional, PRACTITIONER también
clínico, y CASHIER comercial. GROOMER recibe operacional porque ese informe
incluye métricas de peluquería. No se conceden informes comerciales a RECEPTION
ni clínicos a CASHIER por defecto.
