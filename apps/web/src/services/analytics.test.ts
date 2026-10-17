import { describe, expect, it } from 'vitest';
import { sanitizeAnalyticsEvent } from './analytics';

describe('sanitizeAnalyticsEvent', () => {
  it('removes query values and replaces resource ids with a neutral segment', () => {
    const result = sanitizeAnalyticsEvent({
      type: 'pageview',
      url: 'https://easyvet.vercel.app/pacientes/123e4567-e89b-12d3-a456-426614174000?search=ana#detalle',
    });

    expect(result).toEqual({
      type: 'pageview',
      url: 'https://easyvet.vercel.app/pacientes/:id',
    });
  });

  it('drops public signature routes so tokens are never sent to analytics', () => {
    const result = sanitizeAnalyticsEvent({
      type: 'pageview',
      url: 'https://easyvet.vercel.app/firmar/sensitive-token',
    });

    expect(result).toBeNull();
  });
});
