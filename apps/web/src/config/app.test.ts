import { describe, expect, it } from 'vitest';
import { resolveDataMode } from './app';

describe('web runtime data mode', () => {
  it('defaults to the API and permits isolated mock fixtures in development', () => {
    expect(resolveDataMode(undefined, false)).toBe('api');
    expect(resolveDataMode('mock', false)).toBe('mock');
  });

  it('forces production builds to use the real API even if mock mode was requested', () => {
    expect(resolveDataMode('mock', true)).toBe('api');
  });

  it('rejects unknown data modes instead of silently selecting one', () => {
    expect(() => resolveDataMode('unknown', false)).toThrow();
  });
});
