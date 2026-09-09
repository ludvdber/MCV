import { defineConfig } from 'vitest/config';

/**
 * Suite de bout en bout : un vrai navigateur contre une application servie.
 *
 * Volontairement SEPAREE de `vitest.config.js`. Celle-la tourne dans jsdom, ne
 * touche pas au reseau, et doit rester rapide au point qu'on la lance a chaque
 * sauvegarde. Celle-ci demarre Chromium, parle a un serveur et compte en
 * dizaines de secondes : les melanger rendrait la premiere inutilisable et la
 * seconde invisible.
 *
 *   npm run test:e2e                                   (defaut localhost:5173)
 *   MCV_E2E_URL=https://mars.exemple.be npm run test:e2e
 *   MCV_E2E_URL=http://localhost:5173 MCV_E2E_API=https://mars.exemple.be npm run test:e2e
 *
 * La derniere forme sert a eprouver une interface locale contre un backend qui,
 * lui, possede les donnees.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.js'],
    // Un seul navigateur a la fois : les fichiers se partagent la machine et,
    // souvent, le meme serveur en face.
    fileParallelism: false,
    testTimeout: 120000,
    hookTimeout: 300000,
    // Chaque graphe est un aller-retour reseau plus un rendu Plotly reel : une
    // reprise absorbe la latence sans masquer un vrai defaut, qui lui est
    // deterministe.
    retry: 1,
  },
});
