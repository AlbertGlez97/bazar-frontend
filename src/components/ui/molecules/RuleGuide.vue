<template>
  <!-- Molécula: botón ⓘ con la explicación corta y "¿De dónde sale esto?".
       Presentacional: el texto llega por props; no consulta nada. -->
  <div class="rule-guide">
    <button
      type="button"
      class="rule-guide__toggle"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="`Qué significa: ${guide.title}`"
      @click="open = !open"
    >
      <Info
        :size="18"
        aria-hidden="true"
      />
    </button>
    <div
      v-show="open"
      :id="panelId"
      class="rule-guide__panel"
    >
      <p>{{ guide.what }}</p>
      <p>{{ guide.why }}</p>
      <button
        type="button"
        class="rule-guide__source-toggle"
        :aria-expanded="sourceOpen"
        :aria-controls="sourceId"
        @click="sourceOpen = !sourceOpen"
      >
        ¿De dónde sale esto?
      </button>
      <div
        v-show="sourceOpen"
        :id="sourceId"
        class="rule-guide__source"
      >
        <p><strong>{{ guide.source.label }}</strong></p>
        <p>{{ guide.source.text }}</p>
        <a
          v-if="guide.source.url"
          :href="guide.source.url"
          target="_blank"
          rel="noopener noreferrer"
        >Ver la fuente</a>
        <p
          v-else
          class="rule-guide__no-link"
        >
          Aún no tenemos un enlace verificado para esta fuente.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue'
import { Info } from '@lucide/vue'

export interface RuleGuideContent {
  title: string
  what: string
  why: string
  source: { label: string; text: string; url: string | null }
}

defineProps<{ guide: RuleGuideContent }>()

const base = useId()
const panelId = `${base}-panel`
const sourceId = `${base}-source`
const open = ref(false)
const sourceOpen = ref(false)
</script>

<style scoped>
.rule-guide { display: grid; gap: var(--spacing-xs); }
.rule-guide__toggle {
  display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px;
  border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-surface);
  color: var(--color-text-muted); cursor: pointer;
}
.rule-guide__toggle:focus-visible, .rule-guide__source-toggle:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.rule-guide__panel {
  display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface-alt);
  font-size: var(--font-size-sm);
}
.rule-guide__panel p, .rule-guide__source p { margin: 0; }
.rule-guide__source-toggle {
  justify-self: start; min-height: 44px; padding: 0; border: 0; background: none;
  color: var(--color-primary); font: inherit; font-weight: 600; text-decoration: underline; cursor: pointer;
}
.rule-guide__source { display: grid; gap: var(--spacing-xs); }
.rule-guide__no-link { color: var(--color-text-muted); }
</style>
