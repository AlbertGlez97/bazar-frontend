import type { DateRange } from './business-time'

/** Cuánto vive la URL del Blob tras el clic: el navegador necesita que exista mientras empieza la descarga. */
const REVOKE_DELAY_MS = 10_000

/**
 * Nombre de archivo de los reportes de ventas: `ventas-la-marchanta-YYYY-MM-DD.ext`
 * para un solo día y `ventas-la-marchanta-YYYY-MM-DD_a_YYYY-MM-DD.ext` para un
 * rango. Solo minúsculas, dígitos y guiones: válido en cualquier sistema.
 */
export function reportFileName(range: DateRange, extension: 'pdf' | 'xlsx'): string {
  const days = range.from === range.to ? range.from : `${range.from}_a_${range.to}`
  return `ventas-la-marchanta-${days}.${extension}`
}

/** Descarga un Blob con el nombre dado: enlace temporal con URL de objeto, clic y limpieza. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}
