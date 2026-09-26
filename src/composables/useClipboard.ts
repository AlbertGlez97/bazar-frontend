// Copiar un texto al portapapeles. Primero la API moderna; si no existe o el
// navegador la rechaza (permiso denegado, contexto inseguro), el método clásico
// con un <textarea> temporal. Nunca lanza: devuelve si se pudo copiar, y quien la
// usa muestra la salida "cópialo a mano" cuando no.

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  try {
    area.select()
    return document.execCommand('copy') === true
  } catch {
    return false
  } finally {
    area.remove()
  }
}

export function useClipboard() {
  async function copy(text: string): Promise<boolean> {
    if (!text) return false
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // Sin permiso o sin contexto seguro: se prueba el método clásico.
    }
    return legacyCopy(text)
  }

  return { copy }
}
