<template>
  <!-- Un artículo de ayuda: introducción, pasos ordenados, preguntas y cosas a tener en cuenta.
       Todos los artículos se muestran con cualquier rol; "Solo socios" avisa que la acción la hace un socio. -->
  <article
    :id="domId"
    class="help-article"
    :aria-labelledby="showTitle ? titleId : undefined"
    :aria-label="showTitle ? undefined : article.title"
  >
    <header
      v-if="showTitle"
      class="help-article__header"
    >
      <component
        :is="`h${headingLevel}`"
        :id="titleId"
        class="help-article__title"
        tabindex="-1"
        :data-item-id="article.id"
      >
        {{ article.title }}
      </component>
      <AppBadge
        v-if="article.audience === 'socio'"
        color="gray"
      >
        Solo socios
      </AppBadge>
    </header>
    <p class="help-article__intro">
      {{ article.intro }}
    </p>
    <ol v-if="article.steps.length">
      <li
        v-for="step in article.steps"
        :key="step"
      >
        {{ step }}
      </li>
    </ol>
    <dl v-if="article.questions">
      <template
        v-for="item in article.questions"
        :key="item.question"
      >
        <dt>{{ item.question }}</dt>
        <dd>{{ item.answer }}</dd>
      </template>
    </dl>
    <aside
      v-if="article.tips.length"
      class="help-article__tips"
    >
      <component
        :is="`h${headingLevel + 1}`"
        class="help-article__tips-title"
      >
        Ten en cuenta
      </component>
      <ul>
        <li
          v-for="tip in article.tips"
          :key="tip"
        >
          {{ tip }}
        </li>
      </ul>
    </aside>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/components/ui/atoms/AppBadge.vue'
import type { HelpArticle } from '@/types/help.types'

const props = withDefaults(defineProps<{
  article: HelpArticle
  /** DOM id of the `<article>`. */
  domId?: string
  /** Render the title (and the audience badge) here; false when an accordion already shows them. */
  showTitle?: boolean
  /** Level of the article title; the tips heading is one level deeper. */
  headingLevel?: 2 | 3
}>(), {
  domId: undefined,
  showTitle: false,
  headingLevel: 3,
})

const titleId = computed(() => `${props.domId ?? props.article.id}-title`)
</script>

<style scoped>
.help-article { max-width: 70ch; width: 100%; min-width: 0; }
.help-article__header { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs) var(--spacing-sm); margin-bottom: var(--spacing-sm); }
.help-article__title { font-size: var(--font-size-lg); margin: 0; overflow-wrap: anywhere; }
.help-article__title:focus,
.help-article__title:focus-visible { outline: none; } /* programmatic, non-interactive target: no ring */
.help-article p, .help-article li, .help-article dd { line-height: 1.6; overflow-wrap: anywhere; }
.help-article ol { list-style: decimal; padding-left: var(--spacing-lg); margin: var(--spacing-sm) 0; }
.help-article li + li { margin-top: var(--spacing-sm); }
.help-article dt { font-weight: 700; margin-top: var(--spacing-md); overflow-wrap: anywhere; }
.help-article dd { margin: var(--spacing-xs) 0 0; }
.help-article__tips { margin-top: var(--spacing-md); padding: var(--spacing-md); background: var(--color-bg); border-radius: var(--radius-sm); }
.help-article__tips-title { font-size: var(--font-size-md); margin: 0 0 var(--spacing-xs); }
.help-article__tips ul { list-style: disc; padding-left: var(--spacing-lg); }
</style>
