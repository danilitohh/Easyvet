-- Inventory sales use explicit append-only OUT and compensating IN movement types.
ALTER TYPE "InventoryMovementType" ADD VALUE 'SALE_OUT';
ALTER TYPE "InventoryMovementType" ADD VALUE 'SALE_REVERSAL_IN';
