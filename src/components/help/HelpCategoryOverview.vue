<template>
  <section
    class="help-category"
    :aria-labelledby="headingId"
  >
    <header>
      <h2
        :id="headingId"
        class="help-category__title"
        tabindex="-1"
        data-help-heading
      >
        {{ category.title }}
      </h2>
      <p class="help-category__description">
        {{ category.description }}
      </p>
    </header>
    <HelpLinkList :items="topics" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, useId } from 'vue'
import { getHelpCategory } from '@/config/help-structure'
import { helpLocation } from '@/composables/useHelp'
import HelpLinkList from './HelpLinkList.vue'
import type { HelpLinkItem } from './HelpLinkList.vue'

const props = defineProps<{ categoryId: string; from?: string }>()
const emit = defineEmits<{ ready: [] }>()

const headingId = `help-category-${useId()}`
const category = computed(() => getHelpCategory(props.categoryId)!)
const topics = computed<HelpLinkItem[]>(() => category.value.topics.map((topic) => ({
  key: topic.id,
  title: topic.title,
  description: topic.description,
  to: helpLocation({ categoryId: category.value.id, topicId: topic.id }, { from: props.from }),
})))

onMounted(() => emit('ready'))
</script>

<style scoped>
.help-category { display: flex; flex-direction: column; gap: var(--spacing-md); max-width: 70ch; min-width: 0; }
.help-category__title { font-size: var(--font-size-xl); overflow-wrap: anywhere; }
.help-category__title:focus,
.help-category__title:focus-visible { outline: none; } /* programmatic, non-interactive target: no ring */
.help-category__description { margin-top: var(--spacing-xs); color: var(--color-text-muted); }
</style>
