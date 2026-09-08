import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // « coverage » comme « dist » : du code GENERE. Sans lui, le nombre
  // d'avertissements de `npm run lint` depend de si quelqu'un a lance la
  // couverture juste avant (2 de plus, sur des fichiers de rapport).
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      // __APP_VERSION__ et __SITE_URL__ sont injectés par Vite (define) au build.
      globals: { ...globals.browser, __APP_VERSION__: 'readonly', __SITE_URL__: 'readonly' },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // argsIgnorePattern ^[A-Z_] : les composants passés en paramètre de render-prop
      // (ex. (showTable, TableButton) => …, { icon: Icon }) ne sont vus que dans le JSX,
      // que no-unused-vars (sans plugin react) ne traque pas → on les ignore par convention.
      // caughtErrors:none : tolère les `catch (err)` non utilisés.
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^[A-Z_]',
        caughtErrors: 'none',
      }],
    },
  },
  {
    // Les fichiers de TEST et leurs doublures ne sont jamais rechargés à chaud :
    // la règle react-refresh (qui exige qu'un module n'exporte que des
    // composants) n'y décrit aucun risque. Un harnais exporte par nature des
    // composants d'enveloppe ET des utilitaires.
    files: ['src/**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Les contextes co-localisent volontairement Provider + hook (useMars,
    // useThemeMode, useToast) : c'est le pattern React standard, importe
    // partout dans l'app. La regle ne concerne que le confort du Fast
    // Refresh (rechargement complet du module au lieu de HMR fin), pas un
    // bug potentiel — on la coupe uniquement pour ce dossier.
    files: ['src/context/*.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
