<template>
  <!-- Organismo: plantilla de un documento legal (aviso de privacidad, términos). Recibe el
       documento como DATOS (src/legal) y lo pinta: título, versión y fecha visibles, un
       resumen de 5 puntos arriba, un índice con anclas y las secciones. Presentacional: no
       lee stores ni servicios. Pensado para leerse (ancho cómodo) y para imprimirse. -->
  <article
    class="legal-document"
    :aria-labelledby="titleId"
  >
    <header class="legal-document__header">
      <h1
        :id="titleId"
        class="legal-document__title"
      >
        {{ document.title }}
      </h1>
      <p class="legal-document__version">
        Versión {{ version }} ·
        <time :datetime="version">{{ updatedLabel }}</time>
      </p>
    </header>

    <section
      class="legal-document__summary"
      :aria-labelledby="summaryId"
    >
      <h2
        :id="summaryId"
        class="legal-document__summary-title"
      >
        Resumen en 5 puntos
      </h2>
      <ol class="legal-document__summary-list">
        <li
          v-for="point in document.summary"
          :key="point"
        >
          {{ point }}
        </li>
      </ol>
    </section>

    <nav
      class="legal-document__toc"
      aria-label="Contenido"
    >
      <ol class="legal-document__toc-list">
        <li
          v-for="section in document.sections"
          :key="section.id"
        >
          <a :href="`#${section.id}`">{{ section.title }}</a>
        </li>
      </ol>
    </nav>

    <section
      v-for="section in document.sections"
      :key="section.id"
      class="legal-document__section"
      :aria-labelledby="section.id"
    >
      <h2
        :id="section.id"
        class="legal-document__heading"
      >
        {{ section.title }}
      </h2>
      <template
        v-for="(block, index) in section.blocks"
        :key="index"
      >
        <p
          v-if="block.kind === 'p'"
          class="legal-document__p"
        >
          {{ block.text }}
        </p>
        <h3
          v-else-if="block.kind === 'h3'"
          class="legal-document__subheading"
        >
          {{ block.text }}
        </h3>
        <ol
          v-else-if="block.kind === 'list' && block.ordered"
          class="legal-document__list legal-document__ordered"
        >
          <li
            v-for="item in block.items"
            :key="item"
          >
            {{ item }}
          </li>
        </ol>
        <ul
          v-else-if="block.kind === 'list'"
          class="legal-document__list"
        >
          <li
            v-for="item in block.items"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>
      </template>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LegalDocumentData } from '@/legal/types'

const props = defineProps<{
  document: LegalDocumentData
  /** Versión de los textos (AAAA-MM-DD) */
  version: string
  /** La misma fecha, en palabras ("16 de octubre de 2026") */
  updatedLabel: string
}>()

const titleId = computed(() => `${props.document.id}-titulo`)
const summaryId = computed(() => `${props.document.id}-resumen`)
</script>

<style scoped>
.legal-document {
  width: 100%;
  max-width: 44rem;
  margin: 0 auto;
  padding: var(--spacing-lg) var(--spacing-md) var(--spacing-2xl);
  color: var(--color-text);
  font-size: var(--font-size-md);
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.legal-document__title { margin: 0 0 var(--spacing-xs); font-family: var(--font-display); font-size: var(--font-size-2xl); line-height: 1.2; }
.legal-document__version { margin: 0 0 var(--spacing-lg); color: var(--color-text-muted); font-size: var(--font-size-sm); }

/* Resumen: lo primero que se lee */
.legal-document__summary {
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-surface-alt);
  border-left: 6px solid var(--color-primary);
  border-radius: var(--radius-md);
}
.legal-document__summary-title { margin: 0 0 var(--spacing-sm); font-size: var(--font-size-lg); }
.legal-document__summary-list { margin: 0; padding-left: var(--spacing-lg); display: flex; flex-direction: column; gap: var(--spacing-sm); }

/* Índice con anclas */
.legal-document__toc { margin-bottom: var(--spacing-xl); }
.legal-document__toc-list { margin: 0; padding-left: var(--spacing-lg); display: flex; flex-direction: column; gap: var(--spacing-xs); }
.legal-document__toc a {
  display: inline-block;
  min-height: 2rem;
  color: var(--color-primary-hover);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
.legal-document__toc a:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; border-radius: var(--radius-sm); }

.legal-document__section { margin-bottom: var(--spacing-xl); }
.legal-document__heading { margin: 0 0 var(--spacing-sm); font-family: var(--font-display); font-size: var(--font-size-xl); line-height: 1.25; scroll-margin-top: var(--spacing-lg); }
.legal-document__subheading { margin: var(--spacing-md) 0 var(--spacing-xs); font-size: var(--font-size-md); font-weight: 700; }
.legal-document__p { margin: 0 0 var(--spacing-sm); }
.legal-document__list { margin: 0 0 var(--spacing-sm); padding-left: var(--spacing-lg); display: flex; flex-direction: column; gap: var(--spacing-xs); }

/* Impresión: solo el texto, negro sobre blanco, sin índice y sin partir una sección a la mitad */
@media print {
  .legal-document { max-width: none; padding: 0; color: black; background: white; font-size: 11pt; }
  .legal-document__toc { display: none; }
  .legal-document__summary { background: none; border: 1px solid black; }
  .legal-document__version { color: black; }
  .legal-document__section { break-inside: avoid; page-break-inside: avoid; }
  .legal-document__heading,
  .legal-document__subheading { break-after: avoid; page-break-after: avoid; }
}
</style>
