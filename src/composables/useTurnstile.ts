// Carga del script de Cloudflare Turnstile (la verificación "no soy un robot" del registro).
// El script se pide una sola vez y solo cuando se muestra el formulario; si no baja (sin
// internet, bloqueado, lento) se rechaza y el siguiente intento pide uno nuevo. Con
// render=explicit no dibuja nada solo: lo dibuja TurnstileWidget donde corresponde.

export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const LOAD_TIMEOUT_MS = 10_000

export interface TurnstileRenderOptions {
  sitekey: string
  language?: string
  theme?: 'light' | 'dark' | 'auto'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'timeout-callback'?: () => void
  'error-callback'?: () => void
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let pending: Promise<TurnstileApi> | null = null

/** Solo para pruebas: olvida una carga en curso. */
export function resetTurnstileLoader(): void {
  pending = null
}

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (pending) return pending

  pending = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_URL
    script.async = true
    script.defer = true

    const fail = (reason: string) => {
      clearTimeout(timer)
      script.remove()
      pending = null // el siguiente intento pide un script nuevo
      reject(new Error(`Turnstile: ${reason}`))
    }
    const timer = setTimeout(() => fail('el script no respondió a tiempo'), LOAD_TIMEOUT_MS)

    script.addEventListener('load', () => {
      clearTimeout(timer)
      if (window.turnstile) resolve(window.turnstile)
      else fail('el script cargó pero no dejó la API disponible')
    })
    script.addEventListener('error', () => fail('el script no se pudo descargar'))
    document.head.appendChild(script)
  })
  return pending
}
