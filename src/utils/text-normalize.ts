/**
 * Texto para COMPARAR (nunca para mostrar): sin acentos, en minúsculas y sin
 * espacios en los extremos. "  CAFÉ " -> "cafe".
 */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Como `normalizeText`, y además los espacios de en medio se juntan en uno: "Ropa   de  Cama" -> "ropa de cama". */
export function normalizeKey(text: string): string {
  return normalizeText(text).split(/\s+/).join(' ')
}
