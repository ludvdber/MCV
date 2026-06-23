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
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
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
          if (id.includes('plotly.js-dist-min')) return 'plotly';
          if (id.includes('node_modules/three/') || id.includes('@react-three/')) return 'three';
        },
      },
    },
  },
}))
