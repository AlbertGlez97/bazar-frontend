import { HELP_ARTICLES } from '@/config/help-content'
import { breadcrumbOf, getHelpCategory, getHelpTopic } from '@/config/help-structure'
import type { HelpArticle } from '@/types/help.types'

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim()
}

/** Every query token must occur in reader-facing content, never evidence paths. */
export function searchHelp(query: string, articles: readonly HelpArticle[] = HELP_ARTICLES): readonly HelpArticle[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  return articles.filter((article) => {
    const answers = article.questions?.flatMap((item) => [item.question, item.answer]) ?? []
    const text = normalize([article.title, article.category, article.intro, ...article.keywords, ...article.steps, ...article.tips, ...answers].join(' '))
    return tokens.every((token) => text.includes(token))
  })
}

export type HelpMatchField = 'title' | 'topic' | 'category' | 'keyword' | 'intro' | 'steps' | 'questions' | 'tips'

export interface HelpSearchResult {
  articleId: string
  topicId: string
  categoryId: string
  title: string
  /** For example `Finanzas › Jornadas`. */
  breadcrumb: string
  score: number
  /** Every field where at least one token matched, strongest first. A token scores only its strongest field. */
  matchedIn: readonly HelpMatchField[]
}

export interface HelpSuggestion {
  topicId: string
  categoryId: string
  title: string
  breadcrumb: string
}

/** Title hits outrank keyword hits, which outrank body hits. */
const FIELD_WEIGHT: Readonly<Record<HelpMatchField, number>> = {
  title: 10, topic: 8, category: 6, keyword: 5, intro: 3, steps: 2, questions: 2, tips: 1,
}
const FIELD_ORDER = Object.keys(FIELD_WEIGHT) as HelpMatchField[]
const DEFAULT_LIMIT = 20

type IndexedFields = Readonly<Record<HelpMatchField, string>>
interface IndexEntry { article: HelpArticle; topicId: string; categoryId: string; fields: IndexedFields }

let index: readonly IndexEntry[] | undefined

function buildIndex(): readonly IndexEntry[] {
  return HELP_ARTICLES.flatMap((article): IndexEntry[] => {
    const topic = getHelpTopic(article.topic)
    const category = topic ? getHelpCategory(topic.categoryId) : undefined
    if (!topic || !category) return []
    return [{
      article,
      topicId: topic.id,
      categoryId: category.id,
      fields: {
        title: normalize(article.title),
        topic: normalize(`${topic.title} ${topic.description}`),
        category: normalize(category.title),
        keyword: normalize(article.keywords.join(' ')),
        intro: normalize(article.intro),
        steps: normalize(article.steps.join(' ')),
        questions: normalize((article.questions ?? []).flatMap((item) => [item.question, item.answer]).join(' ')),
        tips: normalize(article.tips.join(' ')),
      },
    }]
  })
}

/**
 * Ranked search over category, topic and article text. Every token must match
 * somewhere (AND); each token scores its strongest field. Ties keep catalogue
 * order. Evidence paths are never indexed.
 */
export function searchHelpIndex(query: string, limit: number = DEFAULT_LIMIT): readonly HelpSearchResult[] {
  const tokens = [...new Set(normalize(query).split(/\s+/).filter(Boolean))]
  if (tokens.length === 0 || limit <= 0) return []
  index ??= buildIndex()
  const ranked: HelpSearchResult[] = []
  index.forEach((entry) => {
    let score = 0
    const matched = new Set<HelpMatchField>()
    for (const token of tokens) {
      const hits = FIELD_ORDER.filter((field) => entry.fields[field].includes(token))
      if (hits.length === 0) return
      score += FIELD_WEIGHT[hits[0]!]
      for (const field of hits) matched.add(field)
    }
    const target = { categoryId: entry.categoryId, topicId: entry.topicId }
    ranked.push({
      articleId: entry.article.id,
      topicId: entry.topicId,
      categoryId: entry.categoryId,
      title: entry.article.title,
      breadcrumb: breadcrumbOf(target),
      score,
      matchedIn: FIELD_ORDER.filter((field) => matched.has(field)),
    })
  })
  return ranked
    .sort((a, b) => b.score - a.score) // Array.sort is stable: ties keep catalogue order
    .slice(0, limit)
}

const POPULAR_TOPIC_IDS = ['ventas.primera-venta', 'ventas.efectivo', 'productos.catalogo', 'deudas', 'finanzas.resumen']

/** A few topics to offer when a search finds nothing. */
export function suggestHelpTopics(limit: number = POPULAR_TOPIC_IDS.length): readonly HelpSuggestion[] {
  return POPULAR_TOPIC_IDS.flatMap((id): HelpSuggestion[] => {
    const topic = getHelpTopic(id)
    return topic ? [{
      topicId: topic.id,
      categoryId: topic.categoryId,
      title: topic.title,
      breadcrumb: breadcrumbOf({ categoryId: topic.categoryId, topicId: topic.id }),
    }] : []
  }).slice(0, Math.max(0, limit))
}
