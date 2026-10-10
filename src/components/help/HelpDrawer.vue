<template>
  <!-- Ayuda rápida: un cajón con el tema de la pantalla actual. Se monta una sola vez en el
       layout y lo abre el "?" (o useHelp().openHelpDrawer('finanzas.jornadas.corregir')). -->
  <AppDrawer
    :model-value="helpDrawerOpen"
    :title="title"
    close-label="Cerrar ayuda"
    :return-focus="returnFocus"
    @update:model-value="onUpdate"
  >
    <template #title>
      <CircleHelp
        class="help-drawer__mark"
        :size="22"
        aria-hidden="true"
      />
      <span>{{ title }}</span>
    </template>

    <div class="help-drawer__content">
      <p
        v-if="description"
        class="help-drawer__description"
      >
        {{ description }}
      </p>

      <HelpArticleList
        :articles="articles"
        :selected-id="drawerTarget?.articleId"
        dom-prefix="drawer-"
      />

      <section
        v-if="related.length"
        class="help-drawer__related"
        aria-labelledby="help-drawer-related"
      >
        <h3
          id="help-drawer-related"
          class="help-drawer__related-title"
        >
          Temas relacionados
        </h3>
        <ul>
          <li
            v-for="item in related"
            :key="item.key"
          >
            <HelpLink
              :to="item.to"
              class="help-drawer__related-link"
              @click="closeHelpDrawer"
            >
              {{ item.title }}
              <ChevronRight
                :size="16"
                aria-hidden="true"
              />
            </HelpLink>
          </li>
        </ul>
      </section>
    </div>

    <template #footer>
      <HelpLink
        :to="centerLocation"
        class="help-drawer__cta"
        data-action="open-center"
        @click="closeHelpDrawer"
      >
        Ver toda la ayuda
        <ArrowRight
          :size="18"
          aria-hidden="true"
        />
      </HelpLink>
    </template>
  </AppDrawer>
</template>

<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight, ChevronRight, CircleHelp } from '@lucide/vue'
import AppDrawer from '@/components/ui/organisms/AppDrawer.vue'
import { articlesOfTopic, getHelpCategory, getHelpTopic } from '@/config/help-structure'
import { closeHelpDrawer, drawerTarget, helpDrawerOpen, helpLocation } from '@/composables/useHelp'
import HelpArticleList from './HelpArticleList.vue'
import HelpLink from './HelpLink.vue'

defineProps<{
  /** The opener (`?` button): receives focus on close even in browsers that do not focus buttons on click. */
  returnFocus?: HTMLElement | null
}>()

const route = useRoute()

const category = computed(() => (drawerTarget.value ? getHelpCategory(drawerTarget.value.categoryId) : undefined))
const topic = computed(() => (drawerTarget.value?.topicId ? getHelpTopic(drawerTarget.value.topicId) : undefined))

const title = computed(() => topic.value?.title ?? category.value?.title ?? 'Ayuda')
const description = computed(() => topic.value?.description ?? category.value?.description ?? '')

/** A topic shows its articles; a category (no specific topic) shows those of all its topics. */
const articles = computed(() => {
  if (topic.value) return articlesOfTopic(topic.value.id)
  return category.value?.topics.flatMap((item) => articlesOfTopic(item.id)) ?? []
})

const related = computed(() => (topic.value?.related ?? []).flatMap((id) => {
  const other = getHelpTopic(id)
  return other ? [{
    key: other.id,
    title: other.title,
    to: helpLocation({ categoryId: other.categoryId, topicId: other.id }, { from: route.fullPath }),
  }] : []
}))

/** The Center opens on the same topic (and article), remembering where the person was. */
const centerLocation = computed(() => helpLocation(drawerTarget.value, { from: route.fullPath }))

function onUpdate(open: boolean) {
  if (!open) closeHelpDrawer()
}

// Any navigation (browser back, a link inside the page) leaves the drawer behind.
watch(() => route.fullPath, () => closeHelpDrawer())
// The open flag lives at module level: do not leave it set when the layout goes away.
onUnmounted(() => closeHelpDrawer())
</script>

<style scoped>
.help-drawer__mark { flex-shrink: 0; color: var(--color-primary); vertical-align: -3px; margin-right: var(--spacing-xs); }
.help-drawer__content { display: flex; flex-direction: column; gap: var(--spacing-md); min-width: 0; }
.help-drawer__description { color: var(--color-text-muted); overflow-wrap: anywhere; }
.help-drawer__related-title { font-size: var(--font-size-md); margin-bottom: var(--spacing-xs); }
.help-drawer__related-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  min-height: 44px;
  padding: 0 var(--spacing-xs);
  color: var(--color-primary);
  font-weight: 600;
  border-radius: var(--radius-sm);
  overflow-wrap: anywhere;
  transition: background var(--motion-fast) var(--motion-ease);
}
.help-drawer__related-link:hover { background: color-mix(in srgb, var(--color-primary) 8%, transparent); }
.help-drawer__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  min-height: 48px;
  padding: 0 var(--spacing-md);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: 700;
  border-radius: var(--radius-md);
  transition: background var(--motion-fast) var(--motion-ease);
}
.help-drawer__cta:hover { background: var(--color-primary-hover); }
</style>
