import type { ReactNode } from 'react';
import type { Permission } from '@veterinary-saas/contracts';
import { useCan } from './useCan';

// Can conditionally renders UX affordances without pretending to enforce server authorization.
export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  return useCan(permission) ? children : null;
}
