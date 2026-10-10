<template>
  <!-- Artículos de un tema. Uno solo se muestra abierto, sin acordeón; varios van en
       un acordeón con el pedido (o el primero) expandido. -->
  <HelpArticleContent
    v-if="articles.length === 1"
    :article="articles[0]!"
    :dom-id="`${domPrefix}${articles[0]!.id}`"
    show-title
    :heading-level="3"
  />
  <AppAccordion
    v-else-if="articles.length > 1"
    v-model="open"
    :items="articles"
    :id-prefix="`${domPrefix}help-article`"
    :heading-level="3"
  >
    <template #title="{ item }">
      {{ item.title }}
      <AppBadge
        v-if="item.audience === 'socio'"
        color="gray"
      >
        Solo socios
      </AppBadge>
    </template>
    <template #panel="{ item }">
      <HelpArticleContent
        :article="item"
        :dom-id="`${domPrefix}${item.id}`"
        :heading-level="3"
      />
    </template>
  </AppAccordion>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AppBadge from '@/components/ui/atoms/AppBadge.vue'
import AppAccordion from '@/components/ui/molecules/AppAccordion.vue'
import type { HelpArticle } from '@/types/help.types'
import HelpArticleContent from './HelpArticleContent.vue'

const props = withDefaults(defineProps<{
  articles: readonly HelpArticle[]
  /** Article to expand; the first one when absent or unknown. */
  selectedId?: string
  /** Keeps DOM ids unique when two lists can exist at once. */
  domPrefix?: string
}>(), {
  selectedId: undefined,
  domPrefix: '',
})

function initial(): string | null {
  const match = props.articles.find((article) => article.id === props.selectedId)
  return (match ?? props.articles[0])?.id ?? null
}

const open = ref<string | null>(initial())
watch(() => [props.articles.map((article) => article.id).join('|'), props.selectedId], () => { open.value = initial() })
</script>
