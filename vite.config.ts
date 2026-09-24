import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This configuration enables Vite's fast development server and React support.
export default defineConfig({
  plugins: [react()],
});
