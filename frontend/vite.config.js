/**
 * Configuration Vite pour le frontend Mars Climate Viewer.
 *
 * - Plugin React : active le Fast Refresh (HMR) et la transformation JSX
 * - Proxy : redirige toutes les requetes /api vers le backend Spring Boot
 *   sur http://localhost:8080 en developpement. Cela evite les problemes
 *   de CORS et permet d'utiliser un baseURL relatif ('/api') dans Axios.
 *   En production, le proxy n'est pas necessaire car frontend et backend
 *   sont servis depuis la meme origine.
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
})
