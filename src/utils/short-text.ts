/**
 * Texto corto como lo guarda el servidor: sin espacios en los extremos y con los
 * espacios, tabuladores y saltos de línea de adentro convertidos en UN espacio.
 * Una cadena en blanco queda vacía. (Sin expresión con retroceso: un solo `\s+`.)
 */
export function collapseSpaces(text: string): string {
  return text.trim().split(/\s+/).join(' ')
}
