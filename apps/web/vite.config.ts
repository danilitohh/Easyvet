import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

// Vite remains intentionally small until domain screens are introduced.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
});
