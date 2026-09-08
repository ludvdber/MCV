import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Configuration Vitest (séparée de vite.config.js pour ne pas charger
 * les plugins de build — PWA, manualChunks — pendant les tests).
 */
export default defineConfig({
  // Vite 8 transforme le JSX via oxc, dont le runtime automatique est le défaut
  // (pas besoin d'importer React dans chaque test de composant) — aucune option
  // à passer. L'ancien `esbuild: { jsx: 'automatic' }` était ignoré par oxc.
  // Constantes injectees par Vite au build (bloc `define` de
  // vite.config.js). Sans elles, App.jsx et le pied de page levent un
  // ReferenceError des le rendu et aucun test de page n'est possible.
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __SITE_URL__: JSON.stringify('https://mars.exemple.test'),
  },
  resolve: {
    alias: [
      {
        // plotly.js pese 4,6 Mo, s'appuie sur une geometrie SVG que jsdom ne
        // calcule pas, et n'est pas le code de ce depot. Tous les composants
        // importent Plotly depuis `plotlyBundle` : on y substitue une doublure
        // qui journalise les appels, ce qui rend testable ce que l'application
        // DEMANDE a Plotly (traces, layout, ordre newPlot/react, purge au
        // demontage) sans dependre de ce que Plotly en dessine.
        find: /^(.*)\/plotlyBundle$/,
        replacement: fileURLToPath(new URL('./src/test/plotlyStub.js', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['src/test/setup.js'],
    // Les tests de page montent l'application entiere (providers MUI,
    // i18n, contexte, pages en `lazy()`) : sous charge, l'import seul
    // depasse les 5 s par defaut. Le code applicatif n'est pas lent, le
    // cout est celui de jsdom et des imports.
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      // `all` est LE reglage qui rend la mesure honnete : sans lui, seuls les
      // fichiers qu'un test importe entrent au denominateur, et un module que
      // personne ne teste n'apparait pas du tout. Mesure avant/apres sur ce
      // depot : 61 % sans `all`, 21 % avec. Ne jamais le retirer.
      all: true,
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/main.jsx',          // point d'entree : monte React dans le DOM reel
        'src/plotlyBundle.js',   // agregation d'imports plotly.js, aucune logique
        'src/test/**',           // bouchons jsdom, pas du code applicatif
      ],
      // `json` (coverage-final.json) porte le detail ligne par ligne :
      // c'est lui qui permet de savoir QUOI tester ensuite.
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: 'coverage',
    },
  },
});
