// Composable de instalación PWA — maneja el prompt nativo (Android/desktop) y
// expone helpers para iOS (que NO tiene prompt programático — el user debe
// hacer "Compartir → Agregar a pantalla de inicio" manualmente).

import { ref, computed, onMounted, onBeforeUnmount, readonly } from 'vue'

/** Evento nativo del browser cuando la PWA es instalable */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export type PwaPlatform = 'android' | 'ios' | 'desktop' | 'unknown'

/**
 * Estado global de instalabilidad — lo guardamos afuera de la función factory
 * para que todas las instancias del composable compartan el mismo evento.
 * Si no, solo la primera que monte recibe el prompt.
 */
const installEvent       = ref<BeforeInstallPromptEvent | null>(null)
const isInstalled        = ref(false)
let   listenerRegistered = false

function detectPlatform(): PwaPlatform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua))          return 'android'
  return 'desktop'
}

function detectStandalone(): boolean {
  // iOS expone navigator.standalone; otros browsers usan el media query
  const mm = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
  const ios = typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone === true
  return mm || ios
}

export function usePwaInstall() {
  const platform = detectPlatform()

  function onBeforeInstallPrompt(e: Event) {
    // Evitar que el browser muestre su propio banner — queremos controlar el UX
    e.preventDefault()
    installEvent.value = e as BeforeInstallPromptEvent
  }

  function onAppInstalled() {
    installEvent.value = null
    isInstalled.value  = true
  }

  onMounted(() => {
    isInstalled.value = detectStandalone()

    // Solo registramos los listeners UNA vez a nivel global
    if (!listenerRegistered) {
      listenerRegistered = true
      window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.addEventListener('appinstalled',        onAppInstalled)
    }
  })

  onBeforeUnmount(() => {
    // No removemos los listeners — son globales y otras instancias del
    // composable pueden necesitarlos. Se limpian al cerrar la pestaña.
  })

  /**
   * Dispara el prompt nativo. Solo funciona en Android/desktop.
   * En iOS devuelve 'unsupported' — el caller muestra instrucciones.
   */
  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
    if (!installEvent.value) return 'unsupported'
    await installEvent.value.prompt()
    const choice = await installEvent.value.userChoice
    installEvent.value = null
    return choice.outcome
  }

  const canPrompt = computed(() => installEvent.value !== null)

  return {
    /** true si el evento de instalación está disponible (Android/desktop) */
    canPrompt,
    /** Plataforma detectada — útil para mostrar instrucciones específicas iOS */
    platform,
    /** true si la app ya está corriendo como PWA instalada */
    isInstalled: readonly(isInstalled),
    promptInstall,
  }
}
