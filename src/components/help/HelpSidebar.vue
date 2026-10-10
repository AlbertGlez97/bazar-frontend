<template>
  <nav
    class="help-sidebar"
    aria-label="Temas de ayuda"
  >
    <ul class="help-sidebar__categories">
      <li
        v-for="category in HELP_CATEGORIES"
        :key="category.id"
      >
        <HelpLink
          :to="linkFor(category)"
          class="help-sidebar__category"
          :class="{ 'help-sidebar__category--selected': isSelected(category) }"
          :aria-current="categoryCurrent(category)"
        >
          <component
            :is="HELP_CATEGORY_ICONS[category.id]"
            v-if="HELP_CATEGORY_ICONS[category.id]"
            class="help-sidebar__icon"
            :size="18"
            aria-hidden="true"
          />
          <span>{{ category.title }}</span>
        </HelpLink>
        <ul
          v-if="isSelected(category) && !isSingle(category)"
          class="help-sidebar__topics"
        >
          <li
            v-for="topic in category.topics"
            :key="topic.id"
          >
            <HelpLink
              :to="helpLocation({ categoryId: category.id, topicId: topic.id }, { from })"
              class="help-sidebar__topic"
              :aria-current="target?.topicId === topic.id ? 'page' : undefined"
            >
              {{ topic.title }}
            </HelpLink>
          </li>
        </ul>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import HelpLink from './HelpLink.vue'
import { HELP_CATEGORIES } from '@/config/help-structure'
import { helpLocation } from '@/composables/useHelp'
import type { HelpCategory, HelpTarget } from '@/types/help.types'
import { HELP_CATEGORY_ICONS } from './help-icons'

const props = defineProps<{
  target: HelpTarget | null
  from?: string
}>()

/** A category whose only topic carries its own id (Deudas) is one link, with no sub-list. */
function isSingle(category: HelpCategory) {
  return category.topics.length === 1 && category.topics[0]!.id === category.id
}
function isSelected(category: HelpCategory) {
  return props.target?.categoryId === category.id
}
function linkFor(category: HelpCategory) {
  return helpLocation(isSingle(category) ? category.topics[0]!.id : { categoryId: category.id }, { from: props.from })
}
function categoryCurrent(category: HelpCategory) {
  if (!isSelected(category)) return undefined
  if (isSingle(category)) return props.target?.topicId === category.id ? 'page' : undefined
  return props.target?.topicId ? undefined : 'page'
}
</script>

<style scoped>
.help-sidebar__categories { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.help-sidebar__category,
.help-sidebar__topic {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 44px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  overflow-wrap: anywhere;
  transition: background var(--motion-fast) var(--motion-ease), color var(--motion-fast) var(--motion-ease), box-shadow var(--motion-fast) var(--motion-ease);
}
.help-sidebar__category { font-weight: 700; }
.help-sidebar__icon { flex-shrink: 0; color: var(--color-text-muted); }
.help-sidebar__category:hover,
.help-sidebar__topic:hover { background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
.help-sidebar__category--selected { color: var(--color-primary); }
.help-sidebar__category--selected .help-sidebar__icon { color: var(--color-primary); }
.help-sidebar__category[aria-current='page'],
.help-sidebar__topic[aria-current='page'] {
  background: var(--color-primary-soft);
  color: var(--color-primary-hover);
  box-shadow: inset 3px 0 0 var(--color-primary);
}
.help-sidebar__topics { display: flex; flex-direction: column; margin: var(--spacing-xs) 0 var(--spacing-sm) var(--spacing-lg); padding-left: var(--spacing-sm); border-left: 1px solid var(--color-border); }
.help-sidebar__topic { font-size: var(--font-size-sm); font-weight: 500; }
</style>
