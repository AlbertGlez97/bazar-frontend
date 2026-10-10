<template>
  <section
    class="help-topic"
    :aria-labelledby="headingId"
  >
    <header class="help-topic__header">
      <h2
        :id="headingId"
        ref="heading"
        class="help-topic__title"
        tabindex="-1"
        data-help-heading
      >
        {{ topic.title }}
      </h2>
      <p class="help-topic__description">
        {{ topic.description }}
      </p>
    </header>

    <HelpArticleList
      :articles="articles"
      :selected-id="target.articleId"
    />

    <section
      v-if="related.length"
      class="help-topic__related"
      :aria-labelledby="`${headingId}-related`"
    >
      <h3
        :id="`${headingId}-related`"
        class="help-topic__related-title"
      >
        Temas relacionados
      </h3>
      <HelpLinkList :items="related" />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, useId } from 'vue'
import { articlesOfTopic, getHelpTopic } from '@/config/help-structure'
import { helpLocation } from '@/composables/useHelp'
import type { HelpTarget } from '@/types/help.types'
import HelpArticleList from './HelpArticleList.vue'
import HelpLinkList from './HelpLinkList.vue'
import type { HelpLinkItem } from './HelpLinkList.vue'

const props = defineProps<{
  /** A target that carries a valid `topicId`. */
  target: HelpTarget & { topicId: string }
  from?: string
}>()
const emit = defineEmits<{ ready: [] }>()

const headingId = `help-topic-${useId()}`
const topic = computed(() => getHelpTopic(props.target.topicId)!)
const articles = computed(() => articlesOfTopic(props.target.topicId))
const related = computed<HelpLinkItem[]>(() => (topic.value.related ?? []).flatMap((id) => {
  const other = getHelpTopic(id)
  return other ? [{
    key: other.id,
    title: other.title,
    description: other.description,
    to: helpLocation({ categoryId: other.categoryId, topicId: other.id }, { from: props.from }),
  }] : []
}))

onMounted(() => emit('ready'))
</script>

<style scoped>
.help-topic { display: flex; flex-direction: column; gap: var(--spacing-lg); min-width: 0; }
.help-topic__header { max-width: 70ch; }
.help-topic__title { font-size: var(--font-size-xl); overflow-wrap: anywhere; }
.help-topic__title:focus { outline: none; }
.help-topic__title:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 3px; border-radius: var(--radius-sm); }
.help-topic__description { margin-top: var(--spacing-xs); color: var(--color-text-muted); overflow-wrap: anywhere; }
.help-topic__related { max-width: 70ch; }
.help-topic__related-title { font-size: var(--font-size-md); margin-bottom: var(--spacing-sm); }
</style>
