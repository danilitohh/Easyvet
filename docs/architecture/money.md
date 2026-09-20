# Dinero

La Fase 1 no crea facturación ni operaciones financieras.

Los valores monetarios no deben representarse indiscriminadamente con `float`. Antes de la primera operación financiera se decidirá entre enteros en unidad mínima, `Decimal`/`numeric` de PostgreSQL u otra estrategia equivalente, incluyendo moneda, escala, redondeo, impuestos, límites, auditoría y serialización REST.
