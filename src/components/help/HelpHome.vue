<template>
  <section
    class="help-home"
    :aria-labelledby="headingId"
  >
    <header class="help-home__intro">
      <h2
        :id="headingId"
        class="help-home__title"
        tabindex="-1"
        data-help-heading
      >
        ¿En qué te ayudamos?
      </h2>
      <p>La Marchanta te ayuda a vender, organizar productos y revisar cobros del negocio. Aquí encontrarás pasos para usar las funciones disponibles, sin cambiar tu modo ni tus permisos.</p>
      <p>¿Es tu primera vez? Empieza por Entrar por primera vez y Hacer una primera venta de contado. Los temas marcados Solo socios se pueden leer con cualquier rol, pero sus acciones requieren un socio.</p>
    </header>

    <HelpLinkList
      :items="categories"
      aria-label="Categorías de ayuda"
    />

    <section
      class="help-home__suggested"
      :aria-labelledby="`${headingId}-suggested`"
    >
      <h3
        :id="`${headingId}-suggested`"
        class="help-home__suggested-title"
      >
        Para empezar
      </h3>
      <HelpLinkList :items="suggested" />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, useId } from 'vue'
import { HELP_CATEGORIES } from '@/config/help-structure'
import { helpLocation } from '@/composables/useHelp'
import { suggestHelpTopics } from '@/utils/help-search'
import { HELP_CATEGORY_ICONS } from './help-icons'
import HelpLinkList from './HelpLinkList.vue'
import type { HelpLinkItem } from './HelpLinkList.vue'

const props = defineProps<{ from?: string }>()
const emit = defineEmits<{ ready: [] }>()

const headingId = `help-home-${useId()}`
const categories = computed<HelpLinkItem[]>(() => HELP_CATEGORIES.map((category) => ({
  key: category.id,
  title: category.title,
  description: category.description,
  icon: HELP_CATEGORY_ICONS[category.id],
  // A category with a single same-named topic (Deudas) opens that topic directly.
  to: helpLocation(category.topics.length === 1 && category.topics[0]!.id === category.id ? category.id : { categoryId: category.id }, { from: props.from }),
})))
const suggested = computed<HelpLinkItem[]>(() => suggestHelpTopics(3).map((topic) => ({
  key: topic.topicId,
  title: topic.title,
  description: topic.breadcrumb,
  to: helpLocation({ categoryId: topic.categoryId, topicId: topic.topicId }, { from: props.from }),
})))

onMounted(() => emit('ready'))
</script>

<style scoped>
.help-home { display: flex; flex-direction: column; gap: var(--spacing-lg); max-width: 70ch; min-width: 0; }
.help-home__title { font-size: var(--font-size-xl); margin-bottom: var(--spacing-sm); }
.help-home__title:focus,
.help-home__title:focus-visible { outline: none; } /* programmatic, non-interactive target: no ring */
.help-home__intro p { line-height: 1.6; margin-top: var(--spacing-sm); overflow-wrap: anywhere; }
.help-home__suggested-title { font-size: var(--font-size-md); margin-bottom: var(--spacing-sm); }
</style>
