import { HELP_ARTICLES } from '@/config/help-content'
import type { HelpArticle, HelpAudience, HelpCategory, HelpTarget, HelpTopic } from '@/types/help.types'

interface TopicDefinition {
  id: string
  title: string
  description: string
  related?: readonly string[]
}

interface CategoryDefinition {
  id: string
  title: string
  description: string
  topics: readonly TopicDefinition[]
}

/**
 * Reader-facing structure. Articles declare the topic they belong to; this file
 * only names categories and topics and their order. `articleIds` and `audience`
 * are derived so that structure and content cannot drift apart.
 */
const DEFINITIONS: readonly CategoryDefinition[] = [
  {
    id: 'primeros-pasos',
    title: 'Primeros pasos',
    description: 'Entrar, entender los modos y conocer los límites de la app.',
    topics: [
      { id: 'primeros-pasos.acceso', title: 'Entrar por primera vez', description: 'Cuenta, dispositivo y persona que atiende.' },
      { id: 'primeros-pasos.modos', title: 'Modos y permisos', description: 'Modo Venta, Modo Gestión y qué puede hacer cada rol.' },
      { id: 'primeros-pasos.instalar', title: 'Instalar la app', description: 'Úsala como aplicación en una tablet o teléfono.' },
      { id: 'primeros-pasos.datos', title: 'Tus datos y los de tus clientes', description: 'Qué datos guardas, cómo avisar a tus clientes y dónde están los textos legales.' },
      { id: 'primeros-pasos.preguntas', title: 'Preguntas frecuentes', description: 'Respuestas cortas y límites actuales.' },
    ],
  },
  {
    id: 'ventas',
    title: 'Ventas',
    description: 'Vender, cobrar con efectivo, transferencia o tarjeta y escanear productos.',
    topics: [
      { id: 'ventas.primera-venta', title: 'Primera venta y carrito', description: 'Agregar productos, ajustar cantidades y cobrar.' },
      { id: 'ventas.efectivo', title: 'Cobrar una venta', description: 'Elegir cómo pagan, escribir el monto y dar cambio.', related: ['ventas.primera-venta', 'ventas.escanear'] },
      { id: 'ventas.escanear', title: 'Escanear un producto', description: 'Agregar un producto con su código QR.' },
    ],
  },
  {
    id: 'productos',
    title: 'Productos',
    description: 'El catálogo, sus fotos y las etiquetas.',
    topics: [
      { id: 'productos.catalogo', title: 'Catálogo', description: 'Crear, editar, desactivar y poner foto a los productos.' },
      { id: 'productos.etiquetas-qr', title: 'Etiquetas QR', description: 'Preparar e imprimir etiquetas para tus productos.' },
    ],
  },
  {
    id: 'deudas',
    title: 'Deudas',
    description: 'Fiados, apartados, abonos y fechas de cuotas.',
    topics: [
      { id: 'deudas', title: 'Fiados y apartados', description: 'Registrar una deuda, cobrar abonos y consultar cuotas.' },
    ],
  },
  {
    id: 'finanzas',
    title: 'Finanzas',
    description: 'Aportaciones, gastos, jornadas, reservas, reparto y pagos.',
    topics: [
      { id: 'finanzas.resumen', title: 'Resumen', description: 'Cómo leer las cifras del periodo.' },
      { id: 'finanzas.aportaciones', title: 'Aportaciones', description: 'Registrar el capital que un socio entrega al negocio.' },
      { id: 'finanzas.gastos', title: 'Gastos', description: 'Registrar, anular y corregir gastos y compras de inventario.' },
      { id: 'finanzas.jornadas', title: 'Jornadas', description: 'Registrar quién trabajó y corregir una jornada.' },
      { id: 'finanzas.reservas', title: 'Reservas', description: 'Planes de dinero por periodo; no mueven dinero.' },
      { id: 'finanzas.simulador', title: 'Simulador', description: 'Calcular un reparto sin guardar nada.', related: ['finanzas.acuerdos'] },
      { id: 'finanzas.acuerdos', title: 'Acuerdos', description: 'El documento que conserva una simulación aceptada.', related: ['finanzas.pagos'] },
      { id: 'finanzas.pagos', title: 'Pagos', description: 'Anotar el dinero que ya entregaste por un acuerdo.', related: ['finanzas.acuerdos'] },
    ],
  },
  {
    id: 'administracion',
    title: 'Administración',
    description: 'Incidencias y reportes del negocio.',
    topics: [
      { id: 'administracion.incidencias', title: 'Incidencias', description: 'Revisar y resolver lo que la app detectó.' },
      { id: 'administracion.reportes', title: 'Reportes', description: 'Leer reportes y descargar PDF o Excel.' },
    ],
  },
  {
    id: 'dispositivos-sesion',
    title: 'Dispositivos y sesión',
    description: 'Tu equipo, los dispositivos y tu contraseña.',
    topics: [
      { id: 'dispositivos-sesion.equipo', title: 'Mi equipo', description: 'Consultar al equipo y agregar una persona.' },
      { id: 'dispositivos-sesion.dispositivos', title: 'Dispositivos', description: 'Registrar un dispositivo y administrar su acceso.' },
      { id: 'dispositivos-sesion.contrasena', title: 'Contraseña', description: 'Cambiar tu contraseña con la sesión abierta.' },
    ],
  },
  {
    id: 'offline',
    title: 'Sin conexión',
    description: 'Qué pasa cuando se corta internet.',
    topics: [
      { id: 'offline.pendientes', title: 'Ventas pendientes', description: 'Ventas guardadas, respuestas inciertas y sincronización.' },
    ],
  },
]

function audienceOf(articles: readonly HelpArticle[]): HelpAudience {
  return articles.some((article) => article.audience === 'all') ? 'all' : 'socio'
}

function buildCategories(): readonly HelpCategory[] {
  return DEFINITIONS.map((category) => ({
    id: category.id,
    title: category.title,
    description: category.description,
    topics: category.topics.map((topic): HelpTopic => {
      const articles = HELP_ARTICLES.filter((article) => article.topic === topic.id)
      return {
        id: topic.id,
        categoryId: category.id,
        title: topic.title,
        description: topic.description,
        articleIds: articles.map((article) => article.id),
        audience: audienceOf(articles),
        ...(topic.related ? { related: topic.related } : {}),
      }
    }),
  }))
}

/** Ordered categories, each with its ordered topics. */
export const HELP_CATEGORIES: readonly HelpCategory[] = buildCategories()

export const HELP_TOPICS: readonly HelpTopic[] = HELP_CATEGORIES.flatMap((category) => category.topics)

const categoryById = new Map(HELP_CATEGORIES.map((category) => [category.id, category]))
const topicById = new Map(HELP_TOPICS.map((topic) => [topic.id, topic]))
const articleById = new Map(HELP_ARTICLES.map((article) => [article.id, article]))

export function getHelpCategory(id: string): HelpCategory | undefined {
  return categoryById.get(id)
}

export function getHelpTopic(id: string): HelpTopic | undefined {
  return topicById.get(id)
}

export function getHelpArticle(id: string): HelpArticle | undefined {
  return articleById.get(id)
}

export function topicOfArticle(articleId: string): HelpTopic | undefined {
  const article = articleById.get(articleId)
  return article ? topicById.get(article.topic) : undefined
}

export function articlesOfTopic(topicId: string): readonly HelpArticle[] {
  const topic = topicById.get(topicId)
  if (!topic) return []
  return topic.articleIds.flatMap((id) => articleById.get(id) ?? [])
}

function topicTarget(topic: HelpTopic): HelpTarget {
  return { categoryId: topic.categoryId, topicId: topic.id }
}

/**
 * Resolve a category id, a topic id, an article id or a `topic.articleSlug`
 * path (for example `finanzas.jornadas.corregir`) to a place in the structure.
 * An unknown article slug degrades to its topic; anything else returns null.
 */
export function resolveHelpTarget(idOrPath: string | null | undefined): HelpTarget | null {
  const value = typeof idOrPath === 'string' ? idOrPath.trim() : ''
  if (!value) return null
  const topic = topicById.get(value)
  if (topic) return topicTarget(topic)
  const category = categoryById.get(value)
  if (category) return { categoryId: category.id }
  const article = articleById.get(value)
  if (article) {
    const owner = topicById.get(article.topic)
    if (owner) return { ...topicTarget(owner), articleId: article.id }
  }
  // `<topic id>.<article slug or id>`: the longest topic prefix wins.
  const parts = value.split('.')
  for (let length = parts.length - 1; length >= 1; length -= 1) {
    const owner = topicById.get(parts.slice(0, length).join('.'))
    if (!owner) continue
    const rest = parts.slice(length).join('.')
    const match = articlesOfTopic(owner.id).find((item) => item.slug === rest || item.id === rest)
    return match ? { ...topicTarget(owner), articleId: match.id } : topicTarget(owner)
  }
  return null
}

/** `Finanzas › Jornadas` (a category-level topic shows only the category). */
export function breadcrumbOf(target: HelpTarget): string {
  const category = categoryById.get(target.categoryId)
  const topic = target.topicId ? topicById.get(target.topicId) : undefined
  if (!category) return ''
  if (!topic || topic.title === category.title) return category.title
  return `${category.title} › ${topic.title}`
}
