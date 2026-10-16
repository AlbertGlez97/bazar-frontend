import { describe, expect, it } from 'vitest'
import { HELP_ARTICLES } from '@/config/help-content'
import { searchHelp, searchHelpIndex, suggestHelpTopics } from '../help-search'
import { getHelpTopic, getHelpArticle } from '@/config/help-structure'

describe('local help search', () => {
  it('returns all articles for empty or whitespace input', () => {
    expect(searchHelp('  ')).toEqual(HELP_ARTICLES)
  })
  it('ignores case and accents in titles and keywords', () => {
    expect(searchHelp('  EFECTÍVO  ').map((article) => article.id)).toContain('efectivo')
    expect(searchHelp('codigo qr').map((article) => article.id)).toContain('escanear')
  })
  it('matches all tokens anywhere in reader text, including steps and cautions', () => {
    expect(searchHelp('transferencia tarjeta').map((article) => article.id)).toContain('efectivo')
    expect(searchHelp('no confirma').map((article) => article.id)).toContain('sin-conexion')
    expect(searchHelp('unicornio inexistente')).toEqual([])
    expect(searchHelp('src/components')).toEqual([])
  })
})

describe('ranked help index search', () => {
  const ids = (query: string, limit?: number) => searchHelpIndex(query, limit).map((result) => result.articleId)

  it('returns nothing for an empty, blank or unmatched query', () => {
    expect(searchHelpIndex('')).toEqual([])
    expect(searchHelpIndex('   ')).toEqual([])
    expect(searchHelpIndex('unicornio inexistente')).toEqual([])
    expect(searchHelpIndex('src/components')).toEqual([])
  })

  it('ignores case and accents', () => {
    expect(ids('  EFECTÍVO  ')).toContain('efectivo')
    expect(ids('TRANSFERENCIA MÉTODO')).toContain('efectivo')
    expect(ids('aportacion')[0]).toBe('aportaciones')
    expect(ids('sin conexion')).toContain('sin-conexion')
  })

  it('requires every token (AND), in any reader-facing field', () => {
    expect(ids('transferencia cambio')).toContain('efectivo')
    expect(ids('transferencia unicornio')).toEqual([])
    expect(ids('no confirma')).toContain('sin-conexion')
  })

  it('ranks title hits before keyword hits before body hits', () => {
    const results = searchHelpIndex('reservas')
    expect(results[0]!.articleId).toBe('reservas-finanzas')
    const byId = Object.fromEntries(results.map((result) => [result.articleId, result]))
    expect(byId['resumen-preguntas']).toBeDefined()
    expect(byId['reservas-finanzas']!.score).toBeGreaterThan(byId['resumen-preguntas']!.score)
    expect(byId['reservas-finanzas']!.matchedIn).toContain('title')
    expect(byId['resumen-preguntas']!.matchedIn).not.toContain('title')
    // keyword-only match (cobrar is a keyword of efectivo, not in its title) beats a body-only match of equal tokens
    const cobrar = searchHelpIndex('cobrar')
    const keywordHit = cobrar.find((result) => result.articleId === 'efectivo')!
    expect(keywordHit.matchedIn).toContain('keyword')
    const scores = cobrar.map((result) => result.score)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  it('ranks a keyword-only hit above a body-only hit (fails if the keyword weight drops below the body weights)', () => {
    const STRONG = ['title', 'topic', 'category']
    const BODY = ['intro', 'steps', 'questions', 'tips']
    // Single tokens taken from article keywords; for each, compare the best keyword-only and body-only results.
    const candidates = HELP_ARTICLES.flatMap((article) => article.keywords).map((word) => word.toLowerCase())
    let compared = 0
    for (const token of new Set(candidates)) {
      const results = searchHelpIndex(token, 100)
      const keywordOnly = results.filter((r) => r.matchedIn.includes('keyword') && !r.matchedIn.some((f) => STRONG.includes(f)))
      const bodyOnly = results.filter((r) => !r.matchedIn.includes('keyword') && !r.matchedIn.some((f) => STRONG.includes(f)) && r.matchedIn.some((f) => BODY.includes(f)))
      if (keywordOnly.length === 0 || bodyOnly.length === 0) continue
      compared += 1
      const lastKeyword = Math.max(...keywordOnly.map((r) => results.indexOf(r)))
      const firstBody = Math.min(...bodyOnly.map((r) => results.indexOf(r)))
      expect(lastKeyword, token).toBeLessThan(firstBody)
      expect(Math.min(...keywordOnly.map((r) => r.score)), token).toBeGreaterThan(Math.max(...bodyOnly.map((r) => r.score)))
    }
    expect(compared).toBeGreaterThan(0)
  })

  it('also matches category and topic titles', () => {
    const results = searchHelpIndex('finanzas jornadas')
    expect(results[0]!.topicId).toBe('finanzas.jornadas')
    expect(results[0]!.matchedIn).toEqual(expect.arrayContaining(['category', 'topic']))
  })

  it('describes each result with ids, title and a breadcrumb', () => {
    const result = searchHelpIndex('registrar jornada')[0]!
    expect(result).toMatchObject({
      articleId: 'jornadas',
      topicId: 'finanzas.jornadas',
      categoryId: 'finanzas',
      title: getHelpArticle('jornadas')!.title,
      breadcrumb: 'Finanzas › Jornadas',
    })
    expect(result.score).toBeGreaterThan(0)
    expect(result.matchedIn.length).toBeGreaterThan(0)
  })

  it('finds the jornadas articles and the corregir guidance for "corregir jornada"', () => {
    const results = searchHelpIndex('corregir jornada')
    expect(results[0]!.topicId).toBe('finanzas.jornadas')
    expect(results.map((result) => result.articleId)).toEqual(expect.arrayContaining(['jornadas', 'jornadas-preguntas']))
    expect(getHelpArticle('jornadas')!.steps.join(' ')).toContain('pulsa Corregir')
  })

  it('is deduplicated, stable and limited', () => {
    const first = searchHelpIndex('de')
    expect(new Set(first.map((result) => result.articleId)).size).toBe(first.length)
    expect(searchHelpIndex('de')).toEqual(first)
    expect(first.length).toBeLessThanOrEqual(20)
    expect(searchHelpIndex('de', 3)).toHaveLength(3)
    expect(searchHelpIndex('de', 0)).toEqual([])
    // equal scores keep catalogue order
    const tie = searchHelpIndex('pago').filter((result) => result.score === searchHelpIndex('pago')[0]!.score).map((result) => result.articleId)
    expect(tie).toEqual([...tie].sort((a, b) => HELP_ARTICLES.findIndex((x) => x.id === a) - HELP_ARTICLES.findIndex((x) => x.id === b)))
  })
})

describe('suggested topics', () => {
  it('offers a few distinct existing topics with breadcrumbs', () => {
    const suggestions = suggestHelpTopics()
    expect(suggestions.length).toBeGreaterThanOrEqual(3)
    expect(suggestions.length).toBeLessThanOrEqual(5)
    expect(new Set(suggestions.map((item) => item.topicId)).size).toBe(suggestions.length)
    for (const item of suggestions) {
      expect(getHelpTopic(item.topicId)?.categoryId).toBe(item.categoryId)
      expect(item.breadcrumb.endsWith(item.title)).toBe(true)
    }
    expect(suggestHelpTopics(2)).toHaveLength(2)
  })
})
