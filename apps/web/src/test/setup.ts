import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Clean up each rendered tree so shell tests remain isolated from one another.
afterEach(() => {
  cleanup();
});
