/**
 * Configuration Vite pour le frontend Mars Climate Viewer.
 *
 * - Plugin React : active le Fast Refresh (HMR) et la transformation JSX
 * - Plugin PWA : met en cache les assets statiques (shell, fonts, 3D model)
 * - Proxy : redirige toutes les requetes /api vers le backend Spring Boot
 *   sur http://localhost:8080 en developpement.
 * - manualChunks : isole Plotly.js et Three.js dans des chunks dedies
 *   pour eviter la duplication dans les lazy-loaded pages.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => ({
  define: {
    // eslint-disable-next-line no-undef
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    // plotly.js (build source CJS, cf. src/plotlyBundle.js) reference `global`
    // qui n'existe pas dans le navigateur — on le mappe sur globalThis.
    global: 'globalThis',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Precache : shell de l'app (JS, CSS, HTML, icônes, fonts)
        // Exclut les gros fichiers (mars.glb 4MB, mars-surface.jpg 8MB)
        globPatterns: ['**/*.{css,html,ico,png,svg,woff2}'],
        // JS chunks cachés en runtime (Plotly 4.5MB trop gros pour precache)
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // JS chunks (Plotly, Three.js) : cache à la demande
            urlPattern: /\.js$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'js-cache', expiration: { maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
          {
            // Gros assets 3D/images : cache à la demande
            urlPattern: /\.(glb|jpg)$/i,
            handler: 'CacheFirst',
            options: { cacheName: 'large-assets', expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
          // Polices desormais auto-hebergees dans public/fonts (precache via globPatterns woff2)
        ],
      },
      manifest: {
        name: 'Mars Climate Viewer',
        short_name: 'MCV',
        description: 'Interactive visualization of Mars atmospheric data from GEM-Mars',
        theme_color: '#020818',
        background_color: '#020818',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Bundle Plotly personnalise (plotly.js/lib/core + traces) — voir src/plotlyBundle.js
          const nid = id.replace(/\\/g, '/');
          if (nid.includes('node_modules/plotly.js/')) return 'plotly';
          // Three + ecosysteme R3F (avec ses deps exclusives) : charge uniquement par Home
          if (nid.includes('node_modules/three/')
            || nid.includes('node_modules/three-stdlib/')
            || nid.includes('@react-three/')
            || nid.includes('node_modules/react-reconciler/')
            || nid.includes('node_modules/its-fine/')
            || nid.includes('node_modules/zustand/')
            || nid.includes('node_modules/suspend-react/')) return 'three';
          // Runtime React universel + petits shims PARTAGES entre l'entree et R3F.
          // use-sync-external-store doit etre ici : rolldown l'hebergeait sinon dans
          // le chunk three, que l'entree importait alors statiquement -> 1,1 Mo
          // modulepreload sur toutes les routes.
          if (nid.includes('node_modules/react/')
            || nid.includes('node_modules/react-dom/')
            || nid.includes('node_modules/scheduler/')
            || nid.includes('node_modules/use-sync-external-store/')
            || nid.includes('node_modules/@babel/runtime/')) return 'react';
          // Runtime React universel : chunk dedie pour eviter que rolldown ne le
          // loge dans 'three' (ce qui forcait toutes les pages a precharger 1,1 Mo)
          if (nid.includes('node_modules/react/')
            || nid.includes('node_modules/react-dom/')
            || nid.includes('node_modules/scheduler/')) return 'react';
        },
      },
    },
  },
}))
