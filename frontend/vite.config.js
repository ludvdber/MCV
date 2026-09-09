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
 * ADRESSE PUBLIQUE DU SITE — ELLE N'EST PLUS FIXEE ICI.
 *
 * sitemap.xml, robots.txt et les balises SEO de index.html en dependent, mais
 * l'adresse est desormais resolue par le BACKEND a chaque requete, depuis la
 * propriete `site.public-url` du fichier config/application.properties pose a
 * cote du JAR (a defaut, depuis l'origine de la requete elle-meme).
 *
 * Ce fichier ne grave donc plus aucun domaine dans le livrable : le meme JAR
 * sert correctement sous n'importe quelle adresse, et en changer ne demande
 * qu'un redemarrage. Voir SiteUrlService, SeoController et IndexHtmlController
 * cote Java.
 *
 * En production, le jeton __SITE_URL__ de index.html est laisse INTACT : c'est
 * IndexHtmlController qui le remplace en servant la page. En developpement il
 * n'y a pas de backend devant Vite, on le neutralise donc : un href relatif se
 * resout de toute facon contre l'origine du serveur de dev.
 * ═══════════════════════════════════════════════════════════════════════════ */

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
  { path: '/legal', priority: '0.2' },
]

/** En developpement uniquement : Vite sert la page sans backend devant lui, il
 *  faut donc bien que quelqu'un produise ces deux fichiers. En production ils
 *  viennent de SeoController, qui connait l'adresse configuree. */
function buildSitemap(base) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = SITE_ROUTES.map(({ path, priority }) => (
    '  <url>\n'
    + `    <loc>${base}${path}</loc>\n`
    + `    <lastmod>${today}</lastmod>\n`
    + '    <changefreq>monthly</changefreq>\n'
    + `    <priority>${priority}</priority>\n`
    + '  </url>'
  )).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

function buildRobots(base) {
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
    '# API endpoints should not be indexed',
    'Disallow: /api/',
    'Disallow: /swagger-ui',
    'Disallow: /api-docs',
    '',
  ].join('\n')
}

/** Traite le jeton __SITE_URL__ de index.html et, en dev seulement, sert
 *  sitemap.xml et robots.txt. Ne produit plus RIEN dans le bundle : ces deux
 *  fichiers appartiennent au backend, qui seul connait l'adresse publique. */
function seoPlugin() {
  return {
    name: 'mcv-seo',
    transformIndexHtml(html, ctx) {
      // ctx.server n'existe qu'en developpement. En build on laisse le jeton
      // tel quel : IndexHtmlController le remplacera en servant la page. Le
      // neutraliser ici graverait une valeur vide dans le JAR et le backend
      // n'aurait plus rien a completer.
      return ctx?.server ? html.replaceAll('__SITE_URL__', '') : html
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url !== '/sitemap.xml' && url !== '/robots.txt') { next(); return }
        // L'origine du serveur de dev, lue sur la requete : la meme regle que
        // celle appliquee cote Java quand la propriete n'est pas renseignee.
        const base = `http://${req.headers.host || 'localhost:5173'}`
        if (url === '/sitemap.xml') { res.setHeader('Content-Type', 'application/xml'); res.end(buildSitemap(base)); return }
        res.setHeader('Content-Type', 'text/plain'); res.end(buildRobots(base))
      })
    },
  }
}

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
            // Fragments JS a EMPREINTE uniquement (/assets/) : leur nom change a
            // chaque contenu, donc CacheFirst est sur.
            //
            // Le motif etait /\.js$/i, qui attrapait aussi les scripts a nom
            // STABLE servis a la racine : theme-init.js et registerSW.js. Le
            // backend leur envoie deliberement no-cache (CacheControlFilter) pour
            // qu'une mise en ligne atteigne un visiteur deja venu ; CacheFirst
            // annulait cette regle une couche plus haut et les figeait 30 jours,
            // sans jamais interroger le reseau.
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js'),
            handler: 'CacheFirst',
            options: { cacheName: 'js-cache', expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 } },
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
        },
      },
    },
  },
}))
