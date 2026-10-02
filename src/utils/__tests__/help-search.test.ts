import { describe, expect, it } from 'vitest'
import { HELP_ARTICLES } from '@/config/help-content'
import { searchHelp } from '../help-search'

describe('local help search', () => {
  it('returns all articles for empty or whitespace input', () => {
    expect(searchHelp('  ')).toEqual(HELP_ARTICLES)
  })
  it('ignores case and accents in titles and keywords', () => {
    expect(searchHelp('  EFECTÍVO  ').map((article) => article.id)).toContain('efectivo')
    expect(searchHelp('codigo qr').map((article) => article.id)).toContain('escanear')
  })
  it('matches all tokens anywhere in reader text, including steps and cautions', () => {
    expect(searchHelp('seleccion billetes').map((article) => article.id)).toContain('efectivo')
    expect(searchHelp('no confirma').map((article) => article.id)).toContain('sin-conexion')
    expect(searchHelp('unicornio inexistente')).toEqual([])
    expect(searchHelp('src/components')).toEqual([])
  })
})
