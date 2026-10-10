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
    </header>

    <HelpCenter />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import HelpCenter from '@/components/help/HelpCenter.vue'
import { safeHelpReturnTarget } from '@/utils/help-return'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'

// Route component only: the Center reads and writes the URL, this view owns "Volver".
const router = useRouter()
const route = useRoute()
const mode = useUiModeStore()
const session = useSessionStore()

const returnTarget = computed(() => safeHelpReturnTarget(route.query.from, {
  router,
  isSocio: session.member?.role === 'socio',
  mode: mode.currentMode,
}))
</script>

<style scoped>
.help-view { display: flex; flex-direction: column; gap: var(--spacing-lg); min-width: 0; }
.help-view__intro { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-sm) var(--spacing-md); }
.help-view h1 { font-size: var(--font-size-xl); min-width: 0; overflow-wrap: anywhere; }
</style>
