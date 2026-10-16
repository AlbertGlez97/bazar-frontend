// Instalación PWA — guarda el evento nativo de Chrome (Android/escritorio) y expone lo que
// hace falta para iPhone/iPad, donde NO hay prompt programático (el usuario debe hacer
// "Compartir → Añadir a pantalla de inicio" a mano).
//
// IMPORTANTE: `beforeinstallprompt` se dispara UNA sola vez, al cargar la página. El
// cajón del celular y "Mi cuenta" están cerrados (sin montar) en ese momento, así que
// el listener NO puede registrarse al montar un botón: `initPwaInstall()` se llama al
// arrancar la app (main.ts), antes de montarla, y el evento queda guardado aquí.

import { ref, computed, readonly } from 'vue'

/** Evento nativo del browser cuando la PWA es instalable */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

export type PwaPlatform = 'android' | 'ios' | 'desktop' | 'unknown'
/** En iOS solo Safari puede instalar; Chrome, Firefox, Edge u Opera ahí no. */
export type IosBrowser = 'safari' | 'other'

/**
 * Estado global de instalabilidad: lo guardamos afuera de la función factory para que todas
 * las instancias compartan el mismo evento.
 */
const installEvent = ref<BeforeInstallPromptEvent | null>(null)
const isInstalled = ref(false)
let initialized = false

export function detectPlatform(): PwaPlatform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  // iPadOS se identifica como una Mac: lo delata la pantalla táctil (una Mac no tiene).
  if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

export function detectIosBrowser(): IosBrowser {
  if (typeof navigator === 'undefined') return 'other'
  return /crios|fxios|edgios|opios|gsa\//i.test(navigator.userAgent) ? 'other' : 'safari'
}

function detectStandalone(): boolean {
  // iOS expone navigator.standalone; otros browsers usan el media query
  const mm = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(display-mode: standalone)').matches
  const ios = typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone === true
  return mm || ios
}

function onBeforeInstallPrompt(event: Event) {
  // Evitar que el browser muestre su propio banner — queremos controlar el UX
  event.preventDefault()
  installEvent.value = event as BeforeInstallPromptEvent
}

function onAppInstalled() {
  installEvent.value = null
  isInstalled.value = true
}

/**
 * Registra los listeners UNA vez y guarda el evento aunque ningún componente exista todavía.
 * Se llama desde main.ts antes de montar la app (es idempotente).
 */
export function initPwaInstall() {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  isInstalled.value = detectStandalone()
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)
}

/** Solo para pruebas: deja el estado global como si la app acabara de abrirse. */
export function resetPwaInstallState() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onAppInstalled)
  }
  initialized = false
  installEvent.value = null
  isInstalled.value = false
}

export function usePwaInstall() {
  // Por si algún entorno no pasó por main.ts: es idempotente, pero el registro real es al arrancar.
  initPwaInstall()

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
    /** true si Chrome disparó el evento de instalación (Android/desktop) */
    canPrompt,
    /** Plataforma detectada — iPadOS cuenta como "ios" */
    platform: detectPlatform(),
    /** En iOS: "safari" puede instalar; "other" (Chrome, Firefox…) no */
    iosBrowser: detectIosBrowser(),
    /** true si la app ya está corriendo como PWA instalada */
    isInstalled: readonly(isInstalled),
    promptInstall,
  }
}
