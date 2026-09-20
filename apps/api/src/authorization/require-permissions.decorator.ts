import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@veterinary-saas/contracts';

export const REQUIRED_PERMISSIONS_KEY = 'easyvet:requiredPermissions';

// Multiple permissions are ALL semantics by default; ANY semantics stays explicit for a future need.
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
