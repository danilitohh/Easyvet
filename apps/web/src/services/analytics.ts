import type { BeforeSendEvent } from '@vercel/analytics/react';

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Keep route analytics useful without sending patient, encounter, document, or signature IDs.
export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname.startsWith('/firmar/')) return null;
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname
    .split('/')
    .map((segment) => (UUID_SEGMENT.test(segment) ? ':id' : segment))
    .join('/');
  return { ...event, url: url.toString() };
}
