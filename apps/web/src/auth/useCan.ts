import type { Permission } from '@veterinary-saas/contracts';
import { appConfig } from '../config/app';
import { useAuth } from '../contexts/useAuth';

// Frontend permission checks are UX hints only; backend guards remain authoritative.
export function useCan(permission: Permission): boolean {
  const { activeMembership } = useAuth();
  // Mock mode has no server membership; keep the shell and its demo affordances usable.
  if (appConfig.dataMode === 'mock') return true;
  return activeMembership?.permissions.includes(permission) ?? false;
}
