<template>
  <nav
    class="help-breadcrumb"
    aria-label="Ruta de ayuda"
  >
    <ol>
      <li
        v-for="(crumb, index) in crumbs"
        :key="crumb.key"
      >
        <ChevronRight
          v-if="index > 0"
          class="help-breadcrumb__separator"
          :size="14"
          aria-hidden="true"
        />
        <span
          v-if="index === crumbs.length - 1"
          class="help-breadcrumb__current"
          aria-current="page"
        >{{ crumb.label }}</span>
        <HelpLink
          v-else
          :to="crumb.to"
          class="help-breadcrumb__link"
        >
          {{ crumb.label }}
        </HelpLink>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import HelpLink from './HelpLink.vue'
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { getHelpCategory, getHelpTopic } from '@/config/help-structure'
import { helpLocation } from '@/composables/useHelp'
import type { HelpTarget } from '@/types/help.types'

const props = defineProps<{
  target: HelpTarget | null
  /** Return hint carried through every link. */
  from?: string
}>()

interface Crumb { key: string; label: string; to: ReturnType<typeof helpLocation> }

/**
 * Ayuda › Category › Topic. A topic that repeats its category (Deudas) shows
 * once, as the last crumb.
 */
const crumbs = computed<Crumb[]>(() => {
  const list: Crumb[] = [{ key: 'home', label: 'Ayuda', to: helpLocation(null, { from: props.from }) }]
  const category = props.target ? getHelpCategory(props.target.categoryId) : undefined
  if (!props.target || !category) return list
  list.push({ key: category.id, label: category.title, to: helpLocation({ categoryId: category.id }, { from: props.from }) })
  const topic = props.target.topicId ? getHelpTopic(props.target.topicId) : undefined
  if (topic && topic.id !== category.id) {
    list.push({ key: topic.id, label: topic.title, to: helpLocation({ categoryId: category.id, topicId: topic.id }, { from: props.from }) })
  }
  return list
})
</script>

<style scoped>
.help-breadcrumb ol { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); font-size: var(--font-size-sm); color: var(--color-text-muted); }
.help-breadcrumb li { display: inline-flex; align-items: center; gap: var(--spacing-xs); min-width: 0; }
.help-breadcrumb__separator { flex-shrink: 0; }
.help-breadcrumb__link { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; border-radius: var(--radius-sm); overflow-wrap: anywhere; }
.help-breadcrumb__link:hover { color: var(--color-primary-hover); }
.help-breadcrumb__current { color: var(--color-text); font-weight: 600; overflow-wrap: anywhere; }
</style>
