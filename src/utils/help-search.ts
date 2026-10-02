import { HELP_ARTICLES } from '@/config/help-content'
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
