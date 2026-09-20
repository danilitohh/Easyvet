import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Vite remains intentionally small until domain screens are introduced.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
