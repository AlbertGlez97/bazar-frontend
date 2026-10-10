import { vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import HelpView from '@/views/help/HelpView.vue'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import type { UiMode } from '@/types/ui-mode.types'

type Listener = (event: { matches: boolean }) => void

/** Minimal viewport: `min-width`/`max-width` queries follow `width`; reduced motion follows `reduced`. */
export function mockViewport(initialWidth: number, options: { reduced?: boolean } = {}) {
  let width = initialWidth
  const lists = new Set<{ query: string; listeners: Set<Listener> }>()
  const evaluate = (query: string): boolean => {
    if (query.includes('prefers-reduced-motion')) return options.reduced ?? false
    const min = /min-width:\s*(\d+)px/.exec(query)
    if (min) return width >= Number(min[1])
    const max = /max-width:\s*(\d+)px/.exec(query)
    if (max) return width <= Number(max[1])
    return false
  }
  const previous = window.matchMedia
  window.matchMedia = vi.fn((query: string) => {
    const entry = { query, listeners: new Set<Listener>() }
    lists.add(entry)
    return {
      get matches() { return evaluate(query) },
      media: query,
      onchange: null,
      addEventListener: (_: string, fn: Listener) => entry.listeners.add(fn),
      removeEventListener: (_: string, fn: Listener) => entry.listeners.delete(fn),
      addListener: (fn: Listener) => entry.listeners.add(fn),
      removeListener: (fn: Listener) => entry.listeners.delete(fn),
      dispatchEvent: () => false,
    }
  }) as unknown as typeof window.matchMedia
  return {
    resize(next: number) {
      width = next
      lists.forEach((entry) => entry.listeners.forEach((fn) => fn({ matches: evaluate(entry.query) })))
    },
    restore() { window.matchMedia = previous },
  }
}

export interface OpenHelpOptions {
  query?: Record<string, string>
  width?: number
  mode?: UiMode
  role?: 'socio' | 'colaborador'
}

/** Mounts the Help view on `/app/ayuda` with the routes the return button can reach. */
export async function openHelp({ query = {}, width = 1280, mode = 'venta', role = 'socio' }: OpenHelpOptions = {}) {
  const viewport = mockViewport(width)
  const pinia = createPinia()
  useUiModeStore(pinia).setMode(mode)
  useSessionStore(pinia).setMember({ id: 'm', name: 'Fixture', role, active: true })
  const stub = { template: '<div />' }
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/app/ayuda', name: 'Help', component: HelpView },
    { path: '/app', name: 'AppHome', component: stub },
    { path: '/app/venta', name: 'Sale', component: stub },
    { path: '/app/productos', name: 'ProductCatalog', component: stub },
    { path: '/app/finanzas/jornadas', name: 'WorkShifts', component: stub },
    { path: '/app/reportes', name: 'Reports', component: stub, meta: { requiresSocio: true, requiresGestion: true } },
  ] })
  await router.push({ name: 'Help', query })
  await router.isReady()
  const wrapper = mount(HelpView, { attachTo: document.body, global: { plugins: [pinia, router] } })
  await flushPromises()
  return { wrapper, router, viewport, pinia }
}

/** Ids of every `<article>` currently in the document. */
export function renderedArticleIds(root: ParentNode = document.body): string[] {
  return [...root.querySelectorAll('article[id]')].map((node) => node.id)
}
