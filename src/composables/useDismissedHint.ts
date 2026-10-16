import { ref } from 'vue'

// localStorage puede lanzar (modo privado, cuota, permisos): si falla, la pista se
// muestra y se puede cerrar igual, solo que no se recuerda para la próxima vez.
function readDismissed(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === '1'
  } catch {
    return false
  }
}

/**
 * Una pista que se muestra hasta que se descarta, y se recuerda POR DISPOSITIVO
 * (localStorage): cada teléfono o tablet la ve una sola vez.
 */
export function useDismissedHint(storageKey: string) {
  const dismissed = ref(readDismissed(storageKey))

  function dismiss() {
    dismissed.value = true
    try {
      localStorage.setItem(storageKey, '1')
    } catch {
      // Sin persistencia: se oculta solo en esta carga de la app.
    }
  }

  return { dismissed, dismiss }
}
