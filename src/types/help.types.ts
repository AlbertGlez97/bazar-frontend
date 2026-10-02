export interface HelpArticle {
  id: string
  title: string
  category: string
  audience: 'all' | 'socio'
  keywords: readonly string[]
  intro: string
  steps: readonly string[]
  tips: readonly string[]
  questions?: readonly { question: string; answer: string }[]
}
