/** Un bloque de contenido dentro de una sección de un documento legal. */
export type LegalBlock =
  | { kind: 'p'; text: string }
  /** Subtítulo dentro de la sección (h3). */
  | { kind: 'h3'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }

export interface LegalSection {
  /** Ancla del índice y de los enlaces (minúsculas, números y guiones). */
  id: string
  title: string
  blocks: LegalBlock[]
}

/** Un documento legal como DATOS: lo pinta LegalDocument, no trae HTML. */
export interface LegalDocumentData {
  id: 'privacidad' | 'terminos'
  title: string
  /** Resumen de exactamente 5 puntos que va arriba. */
  summary: string[]
  sections: LegalSection[]
}
