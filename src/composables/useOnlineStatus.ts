import { onScopeDispose, ref, type Ref } from 'vue'

/**
 * `true` mientras el navegador dice que hay conexión. Sigue los eventos
 * `online` / `offline` y se limpia solo al desmontar. Es solo una señal: que el
 * navegador diga "en línea" no garantiza que el servidor responda.
 */
export function useOnlineStatus(): Ref<boolean> {
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  if (typeof window === 'undefined') return online

  const goOnline = () => { online.value = true }
  const goOffline = () => { online.value = false }
  window.addEventListener('online', goOnline)
  window.addEventListener('offline', goOffline)
  onScopeDispose(() => {
    window.removeEventListener('online', goOnline)
    window.removeEventListener('offline', goOffline)
  })
  return online
}
