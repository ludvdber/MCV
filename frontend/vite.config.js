/**
 * Configuration Vite pour le frontend Mars Climate Viewer.
 *
 * - Plugin React : active le Fast Refresh (HMR) et la transformation JSX
 * - Proxy : redirige toutes les requetes /api vers le backend Spring Boot
 *   sur http://localhost:8080 en developpement.
 * - manualChunks : isole Plotly.js et Three.js dans des chunks dedies
 *   pour eviter la duplication dans les lazy-loaded pages.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('plotly.js-dist-min')) return 'plotly';
          if (id.includes('node_modules/three/') || id.includes('@react-three/')) return 'three';
        },
      },
    },
  },
})
