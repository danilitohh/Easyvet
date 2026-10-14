import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

// Vite remains intentionally small until domain screens are introduced.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Supabase's Vercel integration publishes these two values as NEXT_PUBLIC_* variables.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    port: 5173,
  },
});
