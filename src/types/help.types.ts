export type HelpAudience = 'all' | 'socio'

export interface HelpArticle {
  id: string
  /** Id of the topic that owns this article (see `help-structure.ts`). */
  topic: string
  /**
   * Optional short name inside its topic. It lets a three-part path such as
   * `finanzas.jornadas.corregir` preselect this article.
   */
  slug?: string
  title: string
  /** Title of the owning category; kept for backward compatibility. */
  category: string
  audience: HelpAudience
  keywords: readonly string[]
  intro: string
  steps: readonly string[]
  tips: readonly string[]
  questions?: readonly { question: string; answer: string }[]
}

export interface HelpTopic {
  /** `<category>.<slug>`, or the bare category id for a category-level topic. */
  id: string
  categoryId: string
  title: string
  description: string
  articleIds: readonly string[]
  /** Derived: `all` when any of its articles is `all`, otherwise `socio`. */
  audience: HelpAudience
  /** Other topics worth opening next. */
  related?: readonly string[]
}

export interface HelpCategory {
  id: string
  title: string
  description?: string
  topics: readonly HelpTopic[]
}

/** A resolved place in the help structure. */
export interface HelpTarget {
  categoryId: string
  topicId?: string
  articleId?: string
}
