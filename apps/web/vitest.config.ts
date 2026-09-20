import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

// Browser-like test settings cover the first render without adding an E2E dependency.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
