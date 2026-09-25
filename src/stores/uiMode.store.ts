import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { suggestUiMode } from '@/composables/useDeviceCapabilities'
import { isUiMode, type UiMode } from '@/types/ui-mode.types'

/** Clave de localStorage de la preferencia de modo. Es del dispositivo, no de la persona ni de la sesión. */
export const UI_MODE_STORAGE_KEY = 'la-marchanta-ui-mode'

// localStorage puede lanzar (modo privado, cuota, permisos): si falla, el modo
// sigue funcionando en memoria y solo se pierde la persistencia.
function readStoredMode(): UiMode | null {
  try {
    const raw = localStorage.getItem(UI_MODE_STORAGE_KEY)
    return isUiMode(raw) ? raw : null // valor inválido ⇒ se trata como "sin preferencia"
  } catch {
    return null
  }
}

function persistMode(mode: UiMode) {
  try {
    localStorage.setItem(UI_MODE_STORAGE_KEY, mode)
  } catch {
    // Sin persistencia: el modo vale solo para esta carga de la app.
  }
}

/**
 * Modo de interfaz (venta / gestión).
 *
 * Inicialización: ocurre al crearse el store (igual que `session.store`), no en
 * una acción `init()` aparte. Así, quien lo use por primera vez (AppLayout, la
 * vista del catálogo) ya recibe el modo definitivo y no hay orden de montaje
 * que respetar. Sin preferencia guardada, se usa la SUGERENCIA del dispositivo
 * y se guarda de inmediato; con una preferencia válida se respeta tal cual y
 * la sugerencia se ignora. La sugerencia solo propone: nunca decide por encima
 * de lo que la persona ya eligió.
 */
export const useUiModeStore = defineStore('uiMode', () => {
  const stored = readStoredMode()
  const currentMode = ref<UiMode>(stored ?? suggestUiMode())
  if (!stored) persistMode(currentMode.value)

  const isVenta = computed(() => currentMode.value === 'venta')

  function setMode(mode: UiMode) {
    currentMode.value = mode
    persistMode(mode)
  }

  return { currentMode, isVenta, setMode }
})
