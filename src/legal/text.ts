import type { LegalBlock, LegalDocumentData } from './types'

const blockTexts = (block: LegalBlock): string[] => (block.kind === 'list' ? block.items : [block.text])

/** Todo el texto de un documento, en orden: título, resumen y secciones. */
export function documentText(doc: LegalDocumentData): string {
  return [
    doc.title,
    ...doc.summary,
    ...doc.sections.flatMap((section) => [section.title, ...section.blocks.flatMap(blockTexts)]),
  ].join('\n')
}

/** Las frases de un documento (resumen, párrafos y cada elemento de lista), una por una. */
export function documentSentences(doc: LegalDocumentData): string[] {
  const pieces = [...doc.summary, ...doc.sections.flatMap((section) => section.blocks.flatMap(blockTexts))]
  return pieces.flatMap((piece) => piece.split(/(?<=[.!?])\s+/)).map((sentence) => sentence.trim()).filter(Boolean)
}
