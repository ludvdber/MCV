import { defineConfig } from 'vitest/config';

/**
 * Configuration Vitest (séparée de vite.config.js pour ne pas charger
 * les plugins de build — PWA, manualChunks — pendant les tests).
 */
export default defineConfig({
  // Transforme le JSX avec le runtime automatique (pas besoin d'importer React
  // dans chaque test de composant).
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
