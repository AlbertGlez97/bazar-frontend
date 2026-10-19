// Ayuda: marca/presentación/descripción, ficha con QR y "Crear otro igual". Frases de 20 palabras o menos.
import { describe, expect, it } from 'vitest'
import { HELP_ARTICLES } from '../help-content'

const article = (title: string) => HELP_ARTICLES.find((a) => a.title === title)

const TITLES = [
  'Marca, presentación y descripción',
  'Ver la ficha de un producto con el QR',
  'Crear otro producto igual',
] as const

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
const words = (text: string) => text.split(/\s+/).filter(Boolean).length

describe('ayuda de los datos del producto y la ficha', () => {
  it.each(TITLES)('existe «%s»', (title) => {
    expect(article(title)).toBeDefined()
  })

  it.each(TITLES)('«%s»: todas las frases tienen 20 palabras o menos', (title) => {
    const a = article(title)!
    const all = [a.intro, ...a.steps, ...(a.tips ?? [])]
    for (const text of all) for (const sentence of sentences(text)) expect(words(sentence), sentence).toBeLessThanOrEqual(20)
  })

  it('marca/presentación/descripción es para socios y explica el color dentro de la presentación', () => {
    const a = article('Marca, presentación y descripción')!
    expect(a.audience).toBe('socio')
    expect([a.intro, ...a.steps, ...(a.tips ?? [])].join(' ')).toContain('Azul · 28')
  })

  it('la ficha con el QR es para todos y menciona Ver ficha', () => {
    const a = article('Ver la ficha de un producto con el QR')!
    expect(a.audience).toBe('all')
    expect(a.steps.join(' ')).toContain('Ver ficha')
  })

  it('crear otro igual es para socios y dice qué queda vacío', () => {
    const a = article('Crear otro producto igual')!
    expect(a.audience).toBe('socio')
    const text = a.steps.join(' ')
    expect(text).toContain('Presentación')
    expect(text).toContain('Existencia')
  })
})
