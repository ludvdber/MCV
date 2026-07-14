import { defineConfig } from 'vitest/config';

/**
 * Configuration Vitest (séparée de vite.config.js pour ne pas charger
 * les plugins de build — PWA, manualChunks — pendant les tests).
 */
export default defineConfig({
  // Vite 8 transforme le JSX via oxc, dont le runtime automatique est le défaut
  // (pas besoin d'importer React dans chaque test de composant) — aucune option
  // à passer. L'ancien `esbuild: { jsx: 'automatic' }` était ignoré par oxc.
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
