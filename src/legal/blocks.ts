import type { LegalBlock, LegalSection } from './types'

/** Un párrafo. */
export const p = (text: string): LegalBlock => ({ kind: 'p', text })

/** Un subtítulo (h3) dentro de la sección. */
export const h3 = (text: string): LegalBlock => ({ kind: 'h3', text })

/** Una lista con viñetas (o numerada). */
export const list = (items: string[], ordered?: boolean): LegalBlock =>
  ordered === undefined ? { kind: 'list', items } : { kind: 'list', items, ordered }

/**
 * Una sección de un documento legal. Cada texto suelto es un párrafo; un bloque ya armado
 * (lista, subtítulo) se pasa tal cual. Solo abrevia cómo se escribe el documento: el
 * resultado es el mismo dato tipado de siempre.
 */
export function section(id: string, title: string, ...content: (string | LegalBlock)[]): LegalSection {
  return { id, title, blocks: content.map((item) => (typeof item === 'string' ? p(item) : item)) }
}
