import { defineConfig } from 'vitest/config';

/**
 * Configuration Vitest (séparée de vite.config.js pour ne pas charger
 * les plugins de build — PWA, manualChunks — pendant les tests).
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
});
