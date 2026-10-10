<template>
  <div
    class="help-center"
    :class="{ 'help-center--wide': isWide }"
  >
    <HelpSearch
      ref="searchRef"
      v-model="searchText"
      class="help-center__search"
      :count="results.length"
      @clear="clearSearch"
    />

    <div class="help-center__layout">
      <HelpSidebar
        v-if="isWide"
        class="help-center__sidebar"
        :target="target"
        :from="from"
      />

      <div
        ref="main"
        class="help-center__main"
      >
        <HelpLink
          v-if="!isWide && levelBack"
          :to="levelBack.to"
          class="help-center__back"
          data-action="level-back"
          :aria-label="`Volver a ${levelBack.label}`"
        >
          <ArrowLeft
            :size="18"
            aria-hidden="true"
          />
          <span>{{ levelBack.label }}</span>
        </HelpLink>

        <HelpBreadcrumb
          v-if="showBreadcrumb"
          :target="target"
          :from="from"
        />

        <Transition
          name="help-swap"
          mode="out-in"
        >
          <HelpSearchResults
            v-if="kind === 'search'"
            key="search"
            :results="results"
            :query="query"
            :from="from"
            @clear="clearSearch"
            @ready="flushFocus"
          />
          <HelpHome
            v-else-if="kind === 'home'"
            key="home"
            :from="from"
            @ready="flushFocus"
          />
          <HelpCategoryOverview
            v-else-if="kind === 'category'"
            :key="contentKey"
            :category-id="target!.categoryId"
            :from="from"
            @ready="flushFocus"
          />
          <HelpTopicPanel
            v-else-if="topicTarget"
            :key="contentKey"
            :target="topicTarget"
            :from="from"
            @ready="flushFocus"
          />
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import HelpLink from './HelpLink.vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import { getHelpCategory, getHelpTopic, resolveHelpTarget } from '@/config/help-structure'
import { helpLocation, parseHelpQuery } from '@/composables/useHelp'
import { useMediaQuery } from '@/composables/useMediaQuery'
import { usePrefersReducedMotion } from '@/composables/usePrefersReducedMotion'
import { searchHelpIndex } from '@/utils/help-search'
import type { HelpTarget } from '@/types/help.types'
import HelpBreadcrumb from './HelpBreadcrumb.vue'
import HelpCategoryOverview from './HelpCategoryOverview.vue'
import HelpHome from './HelpHome.vue'
import HelpSearch from './HelpSearch.vue'
import HelpSearchResults from './HelpSearchResults.vue'
import HelpSidebar from './HelpSidebar.vue'
import HelpTopicPanel from './HelpTopicPanel.vue'

/** Two columns from this width; below it the Center navigates by levels. */
const WIDE_QUERY = '(min-width: 900px)'
const MAX_QUERY_LENGTH = 100

const route = useRoute()
const router = useRouter()
const isWide = useMediaQuery(WIDE_QUERY, true)
const { scrollBehavior } = usePrefersReducedMotion()

const parsed = computed(() => parseHelpQuery(route.query))
const target = computed(() => parsed.value.target)
const from = computed(() => parsed.value.from)
const query = computed(() => parsed.value.q)

type Kind = 'search' | 'home' | 'category' | 'topic'
const kind = computed<Kind>(() => {
  if (query.value) return 'search'
  if (!target.value) return 'home'
  return target.value.topicId ? 'topic' : 'category'
})
const topicTarget = computed(() => {
  const current = target.value
  return kind.value === 'topic' && current?.topicId ? { ...current, topicId: current.topicId } : null
})
/** Changes when the visible panel is replaced (not when only the article changes). */
const contentKey = computed(() => {
  if (kind.value === 'search' || kind.value === 'home') return kind.value
  return kind.value === 'topic' ? `topic:${target.value?.topicId}` : `category:${target.value?.categoryId}`
})
const showBreadcrumb = computed(() => kind.value === 'category' || kind.value === 'topic')

/** Parent level for the phone "back" control; `null` on the home level. */
const levelBack = computed(() => {
  const current: HelpTarget | null = target.value
  if (!current || kind.value === 'search') return null
  const category = getHelpCategory(current.categoryId)
  const topic = current.topicId ? getHelpTopic(current.topicId) : undefined
  if (topic && category && topic.id !== category.id) {
    return { label: category.title, to: helpLocation({ categoryId: category.id }, { from: from.value }) }
  }
  return { label: 'Ayuda', to: helpLocation(null, { from: from.value }) }
})

// ── Search: the URL owns `q`; the input keeps what the person typed ──────────
const searchRef = ref<InstanceType<typeof HelpSearch> | null>(null)
const searchText = ref(query.value)
const results = computed(() => (query.value ? searchHelpIndex(query.value, 50) : []))

watch(searchText, (value) => {
  const next = value.trim().slice(0, MAX_QUERY_LENGTH)
  if (next === query.value) return
  void router.replace(helpLocation(target.value, { from: from.value, q: next }))
})
watch(query, (value) => {
  if (searchText.value.trim().slice(0, MAX_QUERY_LENGTH) !== value) searchText.value = value
})

let suppressFocus = false
function clearSearch() {
  // Only a real navigation consumes the flag: with a blank query the URL has no `q` to drop.
  if (query.value) suppressFocus = true
  searchText.value = ''
  void nextTick(() => searchRef.value?.focus())
}

// ── Legacy links: /app/ayuda#<article or topic id> (the old single page used hash anchors) ──
function decodeHash(hash: string): string {
  try { return decodeURIComponent(hash.replace(/^#/, '')) } catch { return '' }
}
watch(
  () => [route.hash, route.query.topic] as const,
  ([hash, topic]) => {
    if (!hash || topic !== undefined) return
    const legacy = resolveHelpTarget(decodeHash(hash))
    // The new location has no hash, so this cannot loop. An unknown hash stays on the home view.
    if (legacy) void router.replace(helpLocation(legacy, { from: from.value }))
  },
  { immediate: true },
)

// ── Focus: after a navigation the person lands on the new content ────────────
const main = ref<HTMLElement | null>(null)
let focusPending = false

function searchHasFocus() {
  const element = (searchRef.value as unknown as { $el?: HTMLElement } | null)?.$el
  return !!element && element.contains(document.activeElement)
}

function flushFocus() {
  if (!focusPending) return
  focusPending = false
  const root = main.value
  if (!root) return
  const articleId = target.value?.articleId
  // Compared in code, never interpolated into a selector: the id comes from the URL.
  const article = articleId
    ? ([...root.querySelectorAll<HTMLElement>('[data-item-id]')].find((node) => node.dataset.itemId === articleId) ?? null)
    : null
  const element = article ?? root.querySelector<HTMLElement>('[data-help-heading]')
  element?.focus({ preventScroll: true })
  if (article) article.scrollIntoView?.({ block: 'nearest', behavior: scrollBehavior.value })
}

watch(() => `${contentKey.value}|${target.value?.articleId ?? ''}`, async (key, previous) => {
  if (kind.value === 'search') return
  if (suppressFocus) { suppressFocus = false; return }
  if (searchHasFocus()) return
  focusPending = true
  await nextTick()
  // The same panel stays mounted (only the article changed): there is no "ready" to wait for.
  if (key.split('|')[0] === previous.split('|')[0]) flushFocus()
})

onMounted(() => {
  if (kind.value === 'search') return
  const nothingFocused = !document.activeElement || document.activeElement === document.body
  if (!target.value?.articleId && !nothingFocused) return
  focusPending = true
  void nextTick(flushFocus)
})
</script>

<style scoped>
.help-center { display: flex; flex-direction: column; gap: var(--spacing-lg); min-width: 0; }
.help-center__layout { display: block; min-width: 0; }
.help-center__main { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-md); min-width: 0; }
.help-center__main > * { max-width: 100%; }
.help-center__main > :is(section) { width: 100%; }

.help-center__back {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 44px;
  padding: 0 var(--spacing-sm) 0 var(--spacing-xs);
  color: var(--color-primary);
  font-weight: 600;
  border-radius: var(--radius-sm);
  overflow-wrap: anywhere;
  transition: background var(--motion-fast) var(--motion-ease);
}
.help-center__back:hover { background: color-mix(in srgb, var(--color-primary) 8%, transparent); }

/* Pantallas amplias: barra lateral fija y panel del tema. */
.help-center--wide .help-center__layout {
  display: grid;
  grid-template-columns: minmax(13rem, 17rem) minmax(0, 1fr);
  gap: var(--spacing-xl);
  align-items: start;
}
.help-center__sidebar {
  position: sticky;
  top: calc(var(--header-height) + var(--spacing-md));
  max-height: calc(100dvh - var(--header-height) - 2 * var(--spacing-md));
  overflow-y: auto;
}

/* Cambio de tema: un desvanecido corto con un desplazamiento mínimo. */
.help-swap-enter-active,
.help-swap-leave-active {
  transition: opacity var(--motion-fast) var(--motion-ease), transform var(--motion-fast) var(--motion-ease);
}
.help-swap-enter-from,
.help-swap-leave-to {
  opacity: 0;
  transform: translateY(var(--motion-shift));
}

@media (prefers-reduced-motion: reduce) {
  .help-swap-enter-active,
  .help-swap-leave-active,
  .help-center__back { transition: none; }
  .help-swap-enter-from,
  .help-swap-leave-to { transform: none; }
}
</style>
