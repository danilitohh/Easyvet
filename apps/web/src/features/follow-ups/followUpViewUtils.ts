import type { ClinicalFollowUpSummary } from '@veterinary-saas/contracts';

// Reminder timestamps are instants rendered in the selected organization's timezone.
export function formatFollowUpLocal(value: string | null, timezone: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

// Due state is informational and applies only to currently open follow-ups.
export function dueState(item: Pick<ClinicalFollowUpSummary, 'dueOn' | 'status'>, today: string) {
  if (item.status !== 'OPEN') return null;
  if (item.dueOn < today) return { label: 'Vencido', tone: 'danger' as const };
  if (item.dueOn === today) return { label: 'Hoy', tone: 'warning' as const };
  return { label: 'Próximo', tone: 'info' as const };
}
