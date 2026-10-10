<template>
  <section
    class="help-results"
    :aria-labelledby="headingId"
  >
    <h2
      :id="headingId"
      class="help-results__title"
      tabindex="-1"
      data-help-heading
    >
      Resultados para «{{ query }}»
    </h2>

    <ul
      v-if="results.length"
      class="help-results__list"
    >
      <li
        v-for="result in results"
        :key="result.articleId"
      >
        <HelpLink
          :to="locationOf(result)"
          class="help-results__link"
        >
          <span class="help-results__text">
            <span class="help-results__name">{{ result.title }}</span>
            <span class="help-results__path">{{ result.breadcrumb }}</span>
          </span>
          <ChevronRight
            class="help-results__chevron"
            :size="18"
            aria-hidden="true"
          />
        </HelpLink>
      </li>
    </ul>

    <div
      v-else
      class="help-results__empty"
    >
      <p>No encontramos resultados para «{{ query }}».</p>
      <p>Prueba con una palabra más corta o abre uno de estos temas:</p>
      <HelpLinkList :items="suggestions" />
      <AppButton
        variant="secondary"
        data-action="clear-search-empty"
        @click="emit('clear')"
      >
        Limpiar búsqueda
      </AppButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import HelpLink from './HelpLink.vue'
import { computed, onMounted, useId } from 'vue'
import { ChevronRight } from '@lucide/vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import { helpLocation } from '@/composables/useHelp'
import { suggestHelpTopics } from '@/utils/help-search'
import type { HelpSearchResult } from '@/utils/help-search'
import HelpLinkList from './HelpLinkList.vue'
import type { HelpLinkItem } from './HelpLinkList.vue'

const props = defineProps<{
  results: readonly HelpSearchResult[]
  query: string
  from?: string
}>()
const emit = defineEmits<{ clear: []; ready: [] }>()

const headingId = `help-results-${useId()}`

/** Opening a result leaves the search: topic and article only, no `q`. */
function locationOf(result: HelpSearchResult) {
  return helpLocation({ categoryId: result.categoryId, topicId: result.topicId, articleId: result.articleId }, { from: props.from })
}
const suggestions = computed<HelpLinkItem[]>(() => suggestHelpTopics(4).map((topic) => ({
  key: topic.topicId,
  title: topic.title,
  description: topic.breadcrumb,
  to: helpLocation({ categoryId: topic.categoryId, topicId: topic.topicId }, { from: props.from }),
})))

onMounted(() => emit('ready'))
</script>

<style scoped>
.help-results { display: flex; flex-direction: column; gap: var(--spacing-md); max-width: 70ch; min-width: 0; }
.help-results__title { font-size: var(--font-size-lg); overflow-wrap: anywhere; }
.help-results__title:focus,
.help-results__title:focus-visible { outline: none; } /* programmatic, non-interactive target: no ring */
.help-results__list { display: flex; flex-direction: column; border-top: 1px solid var(--color-border); }
.help-results__list li { border-bottom: 1px solid var(--color-border); }
.help-results__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 56px;
  padding: var(--spacing-sm) var(--spacing-xs);
  border-radius: var(--radius-sm);
  transition: background var(--motion-fast) var(--motion-ease);
}
.help-results__link:hover { background: color-mix(in srgb, var(--color-primary) 7%, transparent); }
.help-results__text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.help-results__name { font-weight: 700; color: var(--color-primary); overflow-wrap: anywhere; }
.help-results__path { color: var(--color-text-muted); font-size: var(--font-size-sm); overflow-wrap: anywhere; }
.help-results__chevron { flex-shrink: 0; color: var(--color-text-muted); }
.help-results__empty { display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-md); }
.help-results__empty p { overflow-wrap: anywhere; }
.help-results__empty :deep(.help-link-list) { align-self: stretch; }
</style>
