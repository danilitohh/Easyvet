import type { Permission } from '@veterinary-saas/contracts';
import { useAuth } from '../contexts/useAuth';

// Frontend permission checks are UX hints only; backend guards remain authoritative.
export function useCan(permission: Permission): boolean {
  const { activeMembership } = useAuth();
  return activeMembership?.permissions.includes(permission) ?? false;
}
