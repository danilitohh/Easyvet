# Estrategia futura de storage

La Fase 1 no conecta Supabase Storage, S3 ni ningún proveedor externo.

## Interfaz prevista

```text
StorageService
  put(input, metadata) -> object reference
  get(reference) -> readable object
  delete(reference) -> void
  createDownloadUrl(reference, policy) -> URL
```

Adaptadores previstos, todavía no implementados:

- `LocalStorageAdapter` para desarrollo controlado.
- `SupabaseStorageAdapter` si el producto lo adopta.
- `S3StorageAdapter` para infraestructura compatible.

Antes de implementarla deben definirse tenant/sucursal, autorización, cifrado, checksum, tamaño/MIME, lifecycle, versionado, retención y eliminación. La interfaz no debe exponer rutas físicas ni aceptar nombres controlados sin normalización.
