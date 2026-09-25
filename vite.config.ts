import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { APP_NAME, APP_DESCRIPTION, THEME_COLOR, BACKGROUND_COLOR } from './src/config/app'

// index.html no puede importar módulos: recibe nombre, descripción y color de
// marca por placeholders que se sustituyen aquí, para no duplicar los literales.
function appBrandHtml(): Plugin {
  return {
    name: 'app-brand-html',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%APP_NAME%', APP_NAME)
        .replaceAll('%APP_DESCRIPTION%', APP_DESCRIPTION)
        .replaceAll('%THEME_COLOR%', THEME_COLOR),
  }
}

export default defineConfig({
  plugins: [
    vue(),
    appBrandHtml(),

    // ── PWA: manifest + service worker con estrategias Workbox ──
    VitePWA({
      registerType: 'prompt',           // avisamos al usuario cuando hay update
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*.png'],

      manifest: {
        name:              APP_NAME,
        short_name:        APP_NAME,
        description:       APP_DESCRIPTION,
        theme_color:       THEME_COLOR,        // terracota de marca (barra de estado móvil)
        background_color:  BACKGROUND_COLOR,   // crema de marca (splash)
        display:           'standalone',
        orientation:       'portrait',
        lang:              'es',
        scope:             '/',
        start_url:         '/',
        categories:        ['business', 'productivity'],
        icons: [
          { src: '/icons/192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Precache automático de todo lo que Vite genera (JS/CSS/HTML/fonts/svg).
        // `wasm`: el lector de QR (zxing) lo necesita para leer SIN internet; se
        // empaqueta con la app (src/services/qr-scanner.ts) y debe estar precacheado.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
        // Las librerías de los reportes (pdfmake, sus fuentes y exceljs, ~2.8 MB en
        // total) se cargan por import() dinámico solo al descargar un archivo: solo
        // las usan los socios en Modo Gestión y con internet, así que no se
        // precachean (cada instalación las bajaría de balde). Se cachean en runtime
        // al usarse (abajo). Los nombres salen del módulo importado; lo vigila
        // src/config/__tests__/pwa-precache.test.ts.
        globIgnores: ['**/assets/pdfmake-*.js', '**/assets/vfs_fonts-*.js', '**/assets/exceljs*.js'],

        // Fallback cuando el user está offline y pide una ruta SPA que no tenemos precacheada
        navigateFallback: '/index.html',
        // Excluí rutas del backend del fallback — no queremos que /api/* devuelva el HTML
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // ── API: GET sin datos sensibles → NetworkFirst con cache corto ──
          // Si hay red, siempre sirve fresco. Si no, fallback al cache de 5 min.
          // NUNCA cachea POST/PUT/DELETE (son mutaciones).
          {
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/v1/') &&
              request.method === 'GET' &&
              // No cachear endpoints de auth — siempre deben ser fresh
              !url.pathname.startsWith('/api/v1/auth/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'marchanta-api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries:    60,
                maxAgeSeconds: 5 * 60,   // 5 minutos
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Librerías de exportación (PDF / Excel): CacheFirst al primer uso ──
          // Los archivos llevan hash en el nombre, así que un archivo cacheado nunca queda viejo.
          {
            urlPattern: ({ url }) => /\/assets\/(pdfmake|vfs_fonts|exceljs)[^/]*\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'export-libs',
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Fuentes de Google Fonts (Bricolage Grotesque + Figtree, ver index.html) ──
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],

        // Activar el SW nuevo inmediatamente tras la actualización (combina con "prompt")
        clientsClaim: true,
        skipWaiting:  false,
      },

      devOptions: {
        enabled: false,         // SW solo en build de prod — evita cachear durante dev
        type:    'module',
      },
    }),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Las imágenes de producto se sirven fuera del prefijo /api/v1 (ruta
      // pública `/uploads/products/<uuid>.png`, ver doc/api-contract-for-
      // frontend.md §1.2) — sin este proxy, en dev el navegador las pide al
      // propio Vite (puerto 5173) en vez del backend y siempre da 404.
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
