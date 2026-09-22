import { civilFieldsFromInstant } from '../agenda/agendaUtils';

// Formats an instant for datetime-local controls in the organization timezone.
export function currentLocalDateTime(instant: string, timezone: string): string {
  const civil = civilFieldsFromInstant(instant, timezone);
  return `${civil.date}T${civil.time}`;
}

// Keeps discharge controls valid when an episode is scheduled in the future.
export function defaultDischargeDateTime(
  admittedAt: string | null,
  timezone: string,
  now = new Date(),
): string {
  const current = currentLocalDateTime(now.toISOString(), timezone);
  if (!admittedAt) return current;
  const admitted = currentLocalDateTime(admittedAt, timezone);
  return admitted > current ? admitted : current;
}
