<template>
  <section
    class="help-view"
    aria-labelledby="help-title"
  >
    <header class="help-view__intro">
      <AppButton
        variant="secondary"
        data-action="return"
        @click="router.replace(returnTarget)"
      >
        <ArrowLeft
          :size="18"
          aria-hidden="true"
        /> Volver
      </AppButton>
      <h1 id="help-title">
        Ayuda de La Marchanta
      </h1>
      <p>La Marchanta te ayuda a vender, organizar productos y revisar cobros del negocio. Aquí encontrarás pasos para usar las funciones disponibles, sin cambiar tu modo ni tus permisos.</p>
      <p>¿Es tu primera vez? Empieza por Entrar por primera vez y Hacer una primera venta de contado. Los temas marcados Solo socios se pueden leer con cualquier rol, pero sus acciones requieren un socio.</p>
    </header>

    <div class="help-view__search">
      <AppInput
        v-model="query"
        type="search"
        label="Buscar en la ayuda"
        placeholder="Ej. cambio, billetes, abonos, etiquetas"
        aria-describedby="help-results"
        size="lg"
      >
        <template #icon-left>
          <Search
            :size="20"
            aria-hidden="true"
          />
        </template>
      </AppInput>
      <AppButton
        v-if="query"
        variant="secondary"
        data-action="clear-search"
        @click="query = ''"
      >
        Limpiar búsqueda
      </AppButton>
      <p
        id="help-results"
        role="status"
        aria-live="polite"
      >
        {{ results.length }} temas disponibles
      </p>
    </div>

    <div class="help-view__layout">
      <details
        class="help-view__index"
        :open="indexOpen"
        @toggle="indexOpen = ($event.target as HTMLDetailsElement).open"
      >
        <summary>Índice de ayuda</summary>
        <nav aria-label="Índice de ayuda">
          <RouterLink
            v-for="article in results"
            :key="article.id"
            :to="{ name: 'Help', query: route.query, hash: `#${article.id}` }"
            @click="focusArticle(article.id)"
          >
            {{ article.title }}
          </RouterLink>
        </nav>
      </details>

      <div class="help-view__articles">
        <p
          v-if="results.length === 0"
          class="help-view__empty"
        >
          No encontramos temas con esas palabras. Prueba una palabra más corta o limpia la búsqueda para ver todo el manual.
        </p>
        <article
          v-for="article in results"
          :id="article.id"
          :key="article.id"
          tabindex="-1"
          class="help-view__article"
          :aria-labelledby="`${article.id}-title`"
        >
          <AppCard>
            <template #header>
              <p class="help-view__category">
                {{ article.category }}
              </p>
              <h2 :id="`${article.id}-title`">
                {{ article.title }}
              </h2>
              <AppBadge
                v-if="article.audience === 'socio'"
                color="gray"
              >
                Solo socios
              </AppBadge>
            </template>
            <p>{{ article.intro }}</p>
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
            <div class="help-view__tips">
              <h3>Ten en cuenta</h3>
              <ul>
                <li
                  v-for="tip in article.tips"
                  :key="tip"
                >
                  {{ tip }}
                </li>
              </ul>
            </div>
          </AppCard>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Search } from '@lucide/vue'
import AppCard from '@/components/ui/organisms/AppCard.vue'
import AppBadge from '@/components/ui/atoms/AppBadge.vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppInput from '@/components/ui/molecules/AppInput.vue'
import { HELP_ARTICLES } from '@/config/help-content'
import { searchHelp } from '@/utils/help-search'
import { landingFor } from '@/router/landing'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'

const router = useRouter()
const route = useRoute()
const mode = useUiModeStore()
const session = useSessionStore()
const query = ref('')
const results = computed(() => searchHelp(query.value))
const indexOpen = ref(false)
let desktopQuery: MediaQueryList | undefined
const adaptIndex = () => { indexOpen.value = desktopQuery?.matches ?? false }
onMounted(() => {
  if (typeof window.matchMedia === 'function') {
    desktopQuery = window.matchMedia('(min-width: 1100px)')
    desktopQuery.addEventListener('change', adaptIndex)
    adaptIndex()
  }
})
onUnmounted(() => desktopQuery?.removeEventListener('change', adaptIndex))

const returnTarget = computed(() => {
  const from = route.query.from
  // Resolve only known local operational routes. Never use browser back, which
  // may leave the app, or allow a forged hint to bypass role/mode restrictions.
  if (typeof from === 'string' && from.startsWith('/app') && !from.startsWith('//')) {
    const target = router.resolve(from)
    const names = ['AppHome', 'ProductCatalog', 'Sale', 'Reports', 'CodigosQr', 'Incidencias', 'Deudas', 'Settings', 'ChangePassword', 'Team', 'DevicesAdmin']
    if (typeof target.name === 'string' && names.includes(target.name)
      && (!target.meta.requiresSocio || session.member?.role === 'socio')
      && (!target.meta.requiresGestion || mode.currentMode === 'gestion')) return target.fullPath
  }
  return landingFor(mode.currentMode)
})

async function focusArticle(id: string) {
  if (!HELP_ARTICLES.some((article) => article.id === id)) return
  if (!results.value.some((article) => article.id === id)) query.value = ''
  await nextTick()
  const target = document.getElementById(id)
  target?.focus({ preventScroll: true })
  target?.scrollIntoView?.({ block: 'start' })
}
watch(() => route.hash, (hash) => { void focusArticle(hash.slice(1)) }, { immediate: true, flush: 'post' })
</script>

<style scoped>
.help-view { display: flex; flex-direction: column; gap: var(--spacing-lg); min-width: 0; }
.help-view__intro { max-width: 70ch; }
.help-view h1 { font-size: var(--font-size-xl); }
.help-view h2 { font-size: var(--font-size-lg); margin: 0 0 var(--spacing-sm); }
.help-view h3 { font-size: var(--font-size-md); }
.help-view dt { font-weight: 700; margin-top: var(--spacing-md); }
.help-view dd { margin: var(--spacing-xs) 0 0; line-height: 1.6; overflow-wrap: anywhere; }
.help-view p, .help-view li { line-height: 1.6; overflow-wrap: anywhere; }
.help-view li + li { margin-top: var(--spacing-sm); }
.help-view__search { display: flex; flex-direction: column; gap: var(--spacing-sm); max-width: 45rem; }
.help-view__search :deep(input) { min-height: 44px; }
.help-view__search p { margin: 0; color: var(--color-text-muted); }
.help-view__layout { display: grid; gap: var(--spacing-lg); min-width: 0; }
.help-view__index { align-self: start; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); }
.help-view__index summary { min-height: 44px; padding: var(--spacing-md); cursor: pointer; font-weight: 700; }
.help-view__index nav { display: flex; flex-direction: column; padding: var(--spacing-sm); }
.help-view__index a { display: flex; align-items: center; min-height: 44px; padding: var(--spacing-sm); color: var(--color-primary); overflow-wrap: anywhere; }
.help-view__index a:focus-visible, .help-view__index summary:focus-visible, .help-view__article:focus { outline: 3px solid var(--color-focus-ring); outline-offset: 3px; }
.help-view__articles { display: flex; flex-direction: column; gap: var(--spacing-lg); min-width: 0; }
.help-view__article { scroll-margin-top: calc(var(--header-height) + var(--spacing-lg)); border-radius: var(--radius-md); }
.help-view__category { color: var(--color-text-muted); margin: 0 0 var(--spacing-xs); }
.help-view__tips { background: var(--color-bg); padding: var(--spacing-md); border-radius: var(--radius-sm); }
.help-view__tips h3 { margin-top: 0; }
.help-view__tips ul { margin-bottom: 0; padding-left: var(--spacing-lg); }
.help-view ol { padding-left: var(--spacing-lg); }
@media (min-width: 1100px) {
  .help-view__layout { grid-template-columns: minmax(13rem, 17rem) minmax(0, 1fr); }
  .help-view__index { position: sticky; top: calc(var(--header-height) + var(--spacing-md)); max-height: calc(100dvh - var(--header-height) - 2 * var(--spacing-md)); overflow-y: auto; }
}
</style>
