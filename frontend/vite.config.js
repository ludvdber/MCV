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

/* ═══════════════════════════════════════════════════════════════════════════
 * URL PUBLIQUE DU SITE — LE SEUL ENDROIT A CHANGER AU DEPLOIEMENT.
 *
 * Le sitemap, robots.txt et les balises SEO de index.html (canonical, Open
 * Graph, Twitter, schema.org) sont tous derives de cette valeur au moment du
 * `npm run build`. Un sitemap DOIT contenir des URL absolues (protocole), on ne
 * peut donc pas les rendre relatives : on centralise plutot le domaine ici.
 *
 * Pour l'IASB : soit remplacer la valeur par defaut ci-dessous par l'URL finale,
 * soit definir la variable d'environnement VITE_SITE_URL au build
 * (ex : `VITE_SITE_URL=https://mars.aeronomie.be npm run build`). Sans slash
 * final : il est ajoute automatiquement la ou il faut.
 * ═══════════════════════════════════════════════════════════════════════════ */
// eslint-disable-next-line no-undef
const SITE_URL = (process.env.VITE_SITE_URL || 'https://mars.ludovdb.be').replace(/\/+$/, '')

/* Routes publiques indexables (a garder en phase avec le routeur React). */
const SITE_ROUTES = [
  { path: '/', priority: '1.0' },
  { path: '/explore', priority: '0.9' },
  { path: '/slice', priority: '0.7' },
  { path: '/animation', priority: '0.7' },
  { path: '/timeseries', priority: '0.6' },
  { path: '/profile', priority: '0.6' },
  { path: '/crosssection', priority: '0.6' },
  { path: '/hovmoller', priority: '0.6' },
  { path: '/zonalmean', priority: '0.6' },
  { path: '/windrose', priority: '0.6' },
  { path: '/difference', priority: '0.6' },
  { path: '/temporal-profile', priority: '0.6' },
]

function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10)
  const urls = SITE_ROUTES.map(({ path, priority }) => (
    '  <url>\n'
    + `    <loc>${SITE_URL}${path}</loc>\n`
    + `    <lastmod>${today}</lastmod>\n`
    + '    <changefreq>monthly</changefreq>\n'
    + `    <priority>${priority}</priority>\n`
    + '  </url>'
  )).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function buildRobots() {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
    '# API endpoints should not be indexed',
    'Disallow: /api/',
    'Disallow: /swagger-ui',
    'Disallow: /api-docs',
    '',
  ].join('\n')
}

/** Genere sitemap.xml + robots.txt depuis SITE_URL et injecte l'URL dans les
 *  balises SEO de index.html (placeholder __SITE_URL__). */
function seoPlugin() {
  return {
    name: 'mcv-seo',
    transformIndexHtml(html) {
      return html.replaceAll('__SITE_URL__', SITE_URL)
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap() })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobots() })
    },
    configureServer(server) {
      // Parite en dev : ces fichiers sont generes au build, on les sert aussi ici.
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url === '/sitemap.xml') { res.setHeader('Content-Type', 'application/xml'); res.end(buildSitemap()); return }
        if (url === '/robots.txt') { res.setHeader('Content-Type', 'text/plain'); res.end(buildRobots()); return }
        next()
      })
    },
  }
}

export default defineConfig(() => ({
  define: {
    // eslint-disable-next-line no-undef
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    // URL publique injectee au build (meme source que le sitemap / SEO ci-dessus) :
    // le SEO runtime par route (App.jsx) l'utilise pour les liens canoniques.
    __SITE_URL__: JSON.stringify(SITE_URL),
    // plotly.js (build source CJS, cf. src/plotlyBundle.js) reference `global`
    // qui n'existe pas dans le navigateur — on le mappe sur globalThis.
    global: 'globalThis',
  },
  plugins: [
    react(),
    seoPlugin(),
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
