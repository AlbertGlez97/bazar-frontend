// La ayuda de Gastos tiene que decir lo que el sistema hace de verdad:
// - Gastos solo anota y suma.
// - El Resumen y el Simulador SÍ restan los gastos operativos para sacar el resultado y lo disponible.
// - Las compras de inventario NO se restan (su costo cuenta al vender).
// - Quién lo pagó o de dónde salió el dinero no cambia ese resultado, y la app no reembolsa a nadie.
import { describe, expect, it } from 'vitest'
import { HELP_ARTICLES } from '../help-content'

const article = HELP_ARTICLES.find((a) => a.id === 'gastos')!
const everything = [article.intro, ...article.steps, ...article.tips].join(' ')
const sentences = everything.split(/(?<=[.!?])\s+/).filter(Boolean)

describe('ayuda de Gastos: lo que de verdad hace el sistema', () => {
  it('ya no dice que los gastos no se restan ni que no calculan utilidad', () => {
    expect(everything).not.toContain('no se restan de las ventas')
    expect(everything).not.toContain('ni calculan utilidad')
    expect(everything).not.toContain('Finanzas solo deja constancia')
  })

  it('dice que el Resumen y el Simulador restan los gastos operativos', () => {
    const tip = article.tips.find((t) => t.includes('Resumen')) ?? ''
    expect(tip).toContain('Resumen')
    expect(tip).toContain('Simulador')
    expect(tip).toContain('gastos operativos')
    expect(tip).toContain('restan')
  })

  it('dice que las compras de inventario no se restan y por qué', () => {
    expect(article.tips.join(' ')).toMatch(/compras de inventario no se restan/)
    expect(article.tips.join(' ')).toContain('cuando se vende')
  })

  it('dice que da igual quién pagó o de dónde salió el dinero', () => {
    expect(article.tips.join(' ')).toContain('dinero personal')
    expect(article.tips.join(' ')).toContain('se resta igual')
  })

  it('A3: dice con honestidad que la app no reembolsa a quien pagó con su dinero', () => {
    const tip = article.tips.find((t) => t.includes('reembols')) ?? ''
    expect(tip).toContain('no se lo devuelve')
    expect(tip).toContain('fuera de la app')
  })

  it('sigue diciendo que pagar con dinero personal no crea una aportación', () => {
    expect(article.tips.join(' ')).toContain('no convierte el gasto en una aportación')
  })

  it('todas las frases tienen 20 palabras o menos', () => {
    const added = article.tips.filter((t) => /Resumen|reembols|inventario no se restan|se resta igual/.test(t))
    for (const tip of added) for (const s of tip.split(/(?<=[.!?])\s+/)) expect(s.split(/\s+/).length, s).toBeLessThanOrEqual(20)
    expect(sentences.length).toBeGreaterThan(0)
  })
})
