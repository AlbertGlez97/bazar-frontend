import { describe, expect, it } from 'vitest'
import { HELP_ARTICLES } from '../help-content'
import {
  HELP_CATEGORIES,
  HELP_TOPICS,
  articlesOfTopic,
  breadcrumbOf,
  getHelpArticle,
  getHelpCategory,
  getHelpTopic,
  resolveHelpTarget,
  topicOfArticle,
} from '../help-structure'

describe('help structure', () => {
  it('places every article in exactly one existing topic, in its own category', () => {
    for (const article of HELP_ARTICLES) {
      const owners = HELP_TOPICS.filter((topic) => topic.articleIds.includes(article.id))
      expect(owners.map((topic) => topic.id), article.id).toEqual([article.topic])
      expect(getHelpCategory(owners[0]!.categoryId)?.title, article.id).toBe(article.category)
    }
    const listed = HELP_TOPICS.flatMap((topic) => topic.articleIds)
    expect(new Set(listed).size).toBe(HELP_ARTICLES.length)
    expect(listed).toHaveLength(HELP_ARTICLES.length)
  })

  it('has no empty category or topic and keeps ids unique', () => {
    for (const category of HELP_CATEGORIES) {
      expect(category.topics.length, category.id).toBeGreaterThan(0)
      for (const topic of category.topics) {
        expect(topic.articleIds.length, topic.id).toBeGreaterThan(0)
        expect(topic.categoryId).toBe(category.id)
        expect(topic.id === category.id || topic.id.startsWith(`${category.id}.`), topic.id).toBe(true)
      }
    }
    const categoryIds = HELP_CATEGORIES.map((category) => category.id)
    const topicIds = HELP_TOPICS.map((topic) => topic.id)
    const articleIds = HELP_ARTICLES.map((article) => article.id)
    expect(new Set(categoryIds).size).toBe(categoryIds.length)
    expect(new Set(topicIds).size).toBe(topicIds.length)
    // A topic id may equal its own category id, but never a foreign id or an article id.
    for (const id of articleIds) {
      expect(topicIds, id).not.toContain(id)
      expect(categoryIds, id).not.toContain(id)
    }
  })

  it('orders the categories and the finance topics sensibly', () => {
    expect(HELP_CATEGORIES.map((category) => category.id)).toEqual([
      'primeros-pasos', 'ventas', 'productos', 'deudas', 'finanzas', 'administracion', 'dispositivos-sesion', 'offline',
    ])
    expect(getHelpCategory('finanzas')!.topics.map((topic) => topic.id)).toEqual([
      'finanzas.resumen', 'finanzas.aportaciones', 'finanzas.gastos', 'finanzas.jornadas',
      'finanzas.reservas', 'finanzas.simulador', 'finanzas.acuerdos', 'finanzas.pagos',
    ])
  })

  it('derives the audience: all when any article is public, otherwise socio', () => {
    for (const topic of HELP_TOPICS) {
      const articles = articlesOfTopic(topic.id)
      expect(topic.audience, topic.id).toBe(articles.some((a) => a.audience === 'all') ? 'all' : 'socio')
    }
    expect(getHelpTopic('ventas.efectivo')!.audience).toBe('all')
    expect(getHelpTopic('finanzas.jornadas')!.audience).toBe('socio')
    expect(getHelpTopic('dispositivos-sesion.contrasena')!.audience).toBe('all')
  })

  it('only references existing topics in related, never itself', () => {
    for (const topic of HELP_TOPICS) {
      for (const id of topic.related ?? []) {
        expect(getHelpTopic(id), `${topic.id} -> ${id}`).toBeDefined()
        expect(id).not.toBe(topic.id)
      }
    }
    expect(getHelpTopic('finanzas.acuerdos')!.related).toContain('finanzas.pagos')
    expect(getHelpTopic('finanzas.pagos')!.related).toContain('finanzas.acuerdos')
    expect(getHelpTopic('finanzas.simulador')!.related).toContain('finanzas.acuerdos')
  })

  it('keeps article slugs unique inside their topic', () => {
    for (const topic of HELP_TOPICS) {
      const slugs = articlesOfTopic(topic.id).flatMap((article) => article.slug ?? [])
      expect(new Set(slugs).size, topic.id).toBe(slugs.length)
    }
  })

  it('groups the finance articles by tab', () => {
    const ids = (topicId: string) => articlesOfTopic(topicId).map((article) => article.id)
    expect(ids('finanzas.aportaciones')).toEqual(['aportaciones'])
    expect(ids('finanzas.gastos')).toEqual(['gastos', 'corregir-gasto'])
    expect(ids('finanzas.jornadas')).toEqual(['jornadas', 'jornadas-preguntas'])
    expect(ids('finanzas.resumen')).toEqual(['resumen-finanzas', 'resumen-preguntas'])
    expect(ids('finanzas.reservas')).toEqual(['reservas-finanzas'])
    expect(ids('finanzas.simulador')).toEqual(['simulador-reparto', 'simulador-preguntas'])
    expect(ids('finanzas.pagos')).toEqual(['pagos-acuerdo', 'pagos-preguntas'])
    expect(ids('finanzas.acuerdos')).toHaveLength(8)
  })

  it('looks things up by id', () => {
    expect(getHelpArticle('jornadas')?.topic).toBe('finanzas.jornadas')
    expect(getHelpArticle('nope')).toBeUndefined()
    expect(getHelpTopic('nope')).toBeUndefined()
    expect(topicOfArticle('jornadas')?.id).toBe('finanzas.jornadas')
    expect(topicOfArticle('nope')).toBeUndefined()
    expect(articlesOfTopic('nope')).toEqual([])
  })

  it('resolves a category, topic, article id or three-part path', () => {
    expect(resolveHelpTarget('finanzas')).toEqual({ categoryId: 'finanzas' })
    expect(resolveHelpTarget('finanzas.jornadas')).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas' })
    expect(resolveHelpTarget('jornadas')).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas', articleId: 'jornadas' })
    expect(resolveHelpTarget('deudas')).toEqual({ categoryId: 'deudas', topicId: 'deudas' })
    expect(resolveHelpTarget('  finanzas.jornadas  ')).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas' })
    expect(resolveHelpTarget('finanzas.jornadas.corregir')).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas', articleId: 'jornadas' })
    expect(resolveHelpTarget('finanzas.gastos.corregir')?.articleId).toBe('corregir-gasto')
    expect(resolveHelpTarget('finanzas.jornadas.jornadas-preguntas')?.articleId).toBe('jornadas-preguntas')
  })

  it('degrades an unknown slug to the topic and rejects unknown input', () => {
    expect(resolveHelpTarget('finanzas.jornadas.no-existe')).toEqual({ categoryId: 'finanzas', topicId: 'finanzas.jornadas' })
    expect(resolveHelpTarget('deudas.no-existe')).toEqual({ categoryId: 'deudas', topicId: 'deudas' })
    for (const value of ['', '   ', 'no-existe', 'finanzas.no-existe', '__proto__', 'constructor', null, undefined]) {
      expect(resolveHelpTarget(value), String(value)).toBeNull()
    }
  })

  it('builds breadcrumbs', () => {
    expect(breadcrumbOf({ categoryId: 'finanzas', topicId: 'finanzas.jornadas' })).toBe('Finanzas › Jornadas')
    expect(breadcrumbOf({ categoryId: 'finanzas' })).toBe('Finanzas')
    expect(breadcrumbOf({ categoryId: 'nope' })).toBe('')
  })
})
