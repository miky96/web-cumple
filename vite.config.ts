import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // `npm run dev:demo` → dades en memòria, sense Firebase
  define: mode === 'demo' ? { 'import.meta.env.VITE_DEMO': JSON.stringify('1') } : {},
  test: {
    environment: 'node',
  },
}));
