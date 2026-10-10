import { computed, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQuery, RouteLocationNormalizedLoaded } from 'vue-router'
import { helpTargetForRoute } from '@/config/help-route-context'
import { getHelpArticle, resolveHelpTarget, topicOfArticle } from '@/config/help-structure'
import type { HelpTarget } from '@/types/help.types'
import { isHelpFromShape } from '@/utils/help-return'

/**
 * Help state lives in the URL: `/app/ayuda?topic=finanzas.jornadas&article=jornadas&from=/app/venta&q=corregir`.
 * `topic` accepts a category id, a topic id, an article id or a `topic.slug` path.
 */

const MAX_QUERY_LENGTH = 100

export interface ParsedHelpQuery {
  /** `null` when nothing valid is selected: the Center shows its home. */
  target: HelpTarget | null
  /** Unvalidated beyond its shape; `safeHelpReturnTarget` makes the final call. */
  from: string | undefined
  q: string
}

export interface HelpLocationOptions {
  from?: unknown
  q?: string
}

function firstValue(value: LocationQuery[string] | undefined): string | undefined {
  const item = Array.isArray(value) ? value[0] : value
  return typeof item === 'string' ? item : undefined
}

function cleanQuery(value: string | undefined): string {
  return (value ?? '').trim().slice(0, MAX_QUERY_LENGTH)
}

/** Read the help query defensively: anything unknown degrades, nothing throws. */
export function parseHelpQuery(query: LocationQuery): ParsedHelpQuery {
  let target = resolveHelpTarget(firstValue(query.topic))
  const articleParam = firstValue(query.article)
  const article = articleParam ? getHelpArticle(articleParam) : undefined
  const owner = article ? topicOfArticle(article.id) : undefined
  if (article && owner) {
    const fits = !target || target.topicId === owner.id || (!target.topicId && target.categoryId === owner.categoryId)
    if (fits) target = { categoryId: owner.categoryId, topicId: owner.id, articleId: article.id }
  }
  const from = firstValue(query.from)
  return { target, from: isHelpFromShape(from) ? from : undefined, q: cleanQuery(firstValue(query.q)) }
}

/** The Help route location for a target (resolved object, id or path), or the Center home. */
export function helpLocation(
  target: HelpTarget | string | null | undefined,
  { from, q }: HelpLocationOptions = {},
): { name: 'Help'; query: Record<string, string> } {
  const resolved = typeof target === 'string' ? resolveHelpTarget(target) : target ?? null
  const query: Record<string, string> = {}
  if (resolved) {
    query.topic = resolved.topicId ?? resolved.categoryId
    if (resolved.articleId && resolved.topicId) query.article = resolved.articleId
  }
  if (isHelpFromShape(from)) query.from = from
  const search = cleanQuery(q)
  if (search) query.q = search
  return { name: 'Help', query }
}

// Drawer state: module level on purpose (one drawer per app, no store needed).
export const helpDrawerOpen = ref(false)
export const drawerTarget = shallowRef<HelpTarget | null>(null)

// Set by `useHelp()` so the drawer can ask which route it is opened from.
let activeRoute: RouteLocationNormalizedLoaded | undefined

const DEFAULT_TARGET: HelpTarget = { categoryId: 'primeros-pasos' }

/**
 * Open the quick-help drawer. Without an argument it uses the topic of the
 * current route; it does not open on the Help page itself (returns false).
 */
export function openHelpDrawer(idOrPath?: string): boolean {
  // The Help page already is the help: an explicit id does not open a duplicate drawer either.
  if (activeRoute?.name === 'Help') return false
  const target = idOrPath === undefined
    ? helpTargetForRoute(activeRoute?.name, activeRoute?.path)
    : resolveHelpTarget(idOrPath) ?? DEFAULT_TARGET
  if (!target) return false
  drawerTarget.value = target
  helpDrawerOpen.value = true
  return true
}

/** Closing keeps `drawerTarget` so the content does not vanish during the exit motion. */
export function closeHelpDrawer(): void {
  helpDrawerOpen.value = false
}

export function useHelp() {
  const router = useRouter()
  const route = useRoute()
  activeRoute = route

  const currentRouteTarget = computed(() => helpTargetForRoute(route.name, route.path))

  function returnHint(): string | undefined {
    const source = route.name === 'Help' ? firstValue(route.query.from) : route.fullPath
    return isHelpFromShape(source) ? source : undefined
  }

  /**
   * Navigate to the Help Center. Accepts a category id, topic id, article id,
   * `topic.slug` path or a resolved target; with no argument it opens the topic
   * of the current route.
   */
  function openHelp(idOrPath?: string | HelpTarget | null) {
    const target = idOrPath === undefined ? currentRouteTarget.value : idOrPath
    return router.push(helpLocation(target, { from: returnHint() }))
  }

  return {
    openHelp,
    openHelpDrawer,
    closeHelpDrawer,
    helpDrawerOpen,
    drawerTarget,
    currentRouteTarget,
  }
}
