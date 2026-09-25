// Punto de entrada de la aplicación Vue 3
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from './App.vue'

// CSS global con variables de diseño, utilidades y componentes base
import '@/assets/main.css'

const app = createApp(App)

// Registra el store global (Pinia) antes del router
app.use(createPinia())
app.use(router)

app.mount('#app')

// ── PWA Service Worker — registra y expone hook para prompt de update ──
// En dev el plugin está desactivado (devOptions.enabled=false) así que esto
// es un no-op local. En build de producción registra el SW de Workbox.
if (import.meta.env.PROD) {
  registerServiceWorkerWithUpdatePrompt()
}

async function registerServiceWorkerWithUpdatePrompt() {
  try {
    const { registerSW } = await import('virtual:pwa-register')
    const { useToastStore } = await import('@/stores/toast.store')

    registerSW({
      // onNeedRefresh se dispara cuando hay una versión nueva del SW esperando
      onNeedRefresh() {
        const toast = useToastStore()
        toast.info('Hay una versión nueva. Recarga la página para verla.')
      },
      onOfflineReady() {
        const toast = useToastStore()
        toast.success('La app ya abre sin internet. Los datos sí necesitan conexión.')
      },
    })
  } catch (err) {
    // Si el SW falla (browser sin soporte o red sin HTTPS) seguimos sin él
    console.warn('[PWA] No se pudo registrar el service worker:', err)
  }
}
