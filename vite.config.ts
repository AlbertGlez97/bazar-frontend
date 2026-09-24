import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),

    // ── PWA: manifest + service worker con estrategias Workbox ──
    VitePWA({
      registerType: 'prompt',           // avisamos al usuario cuando hay update
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/*.png'],

      manifest: {
        name:              'FinanzasApp — Gestión financiera con cifrado E2EE',
        short_name:        'FinanzasApp',
        description:       'Tu plata, tus reglas. Presupuesto, deudas y ahorros con cifrado de extremo a extremo.',
        theme_color:       '#2563eb',   // azul de brand (barra de estado móvil)
        background_color:  '#080d17',   // fondo dark del splash
        display:           'standalone',
        orientation:       'portrait',
        lang:              'es',
        scope:             '/',
        start_url:         '/',
        categories:        ['finance', 'productivity'],
        icons: [
          { src: '/icons/192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Precache automático de todo lo que Vite genera (JS/CSS/HTML/fonts/svg)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

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
              cacheName: 'finanzas-api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries:    60,
                maxAgeSeconds: 5 * 60,   // 5 minutos
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },

          // ── Fuentes de Google Fonts (si se usan en el futuro) ──
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
    },
  },
})
