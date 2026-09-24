<template>
  <!-- Drawer lateral derecho con el artículo de ayuda contextual.
       El padre controla `open` y escucha `close` (props in / events out
       en lugar de v-model porque varias vistas necesitan abrirlo desde
       distintos botones manteniendo el mismo state local). -->
  <Teleport to="body">
    <Transition name="help-drawer">
      <div
        v-if="open"
        class="help-drawer-backdrop"
        @click.self="$emit('close')"
        role="dialog"
        :aria-modal="true"
        aria-label="Ayuda contextual"
      >
        <aside class="help-drawer">
          <!-- Header: título del artículo + cerrar -->
          <header class="help-drawer__header">
            <div class="help-drawer__heading">
              <span class="help-drawer__eyebrow">📖 Ayuda</span>
              <h2 class="help-drawer__title">
                {{ article ? article.title : 'Artículo no encontrado' }}
              </h2>
              <span v-if="article" class="help-drawer__meta">⏱ {{ article.readTime }} de lectura</span>
            </div>
            <button
              type="button"
              class="help-drawer__close"
              @click="$emit('close')"
              aria-label="Cerrar ayuda"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>

          <!-- Body: render del artículo. Misma estructura visual que GuideView
               (sections con paragraphs/list/example/callout y sources al final),
               pero con tipografía algo más compacta para caber en 380px. -->
          <div class="help-drawer__body">
            <template v-if="article">
              <p class="help-drawer__summary">{{ article.summary }}</p>

              <section
                v-for="(sec, i) in article.sections"
                :key="i"
                class="help-drawer__section"
              >
                <h3 v-if="sec.heading" class="help-drawer__h3">{{ sec.heading }}</h3>
                <p
                  v-for="(p, pi) in sec.paragraphs"
                  :key="'p' + pi"
                  class="help-drawer__p"
                >{{ p }}</p>

                <ul v-if="sec.list" class="help-drawer__list">
                  <li v-for="(item, li) in sec.list" :key="'l' + li">{{ item }}</li>
                </ul>

                <div v-if="sec.example" class="help-drawer__example">
                  <div class="help-drawer__example-title">📐 {{ sec.example.title }}</div>
                  <pre class="help-drawer__example-body">{{ sec.example.lines.join('\n') }}</pre>
                </div>

                <div
                  v-if="sec.callout"
                  class="help-drawer__callout"
                  :class="`help-drawer__callout--${sec.callout.kind}`"
                >
                  <span class="help-drawer__callout-icon">
                    {{ sec.callout.kind === 'warn' ? '⚠️' : sec.callout.kind === 'tip' ? '💡' : 'ℹ️' }}
                  </span>
                  <span>{{ sec.callout.text }}</span>
                </div>
              </section>

              <!-- Fuentes — versión compacta de la sección de GuideView -->
              <footer v-if="article.sources.length" class="help-drawer__sources">
                <h4 class="help-drawer__sources-title">📚 Fuentes</h4>
                <ul class="help-drawer__sources-list">
                  <li v-for="(src, si) in article.sources" :key="'s' + si">
                    <a
                      :href="src.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="help-drawer__source"
                    >
                      <span class="help-drawer__source-org">{{ src.org }}</span>
                      <span class="help-drawer__source-label">{{ src.label }}</span>
                      <span class="help-drawer__source-ext">↗</span>
                    </a>
                  </li>
                </ul>
              </footer>
            </template>

            <!-- Slug inválido o artículo aún no escrito -->
            <div v-else class="help-drawer__empty">
              <p>No encontramos el artículo de ayuda para esta vista.</p>
              <p class="help-drawer__empty-hint">
                Slug solicitado: <code>{{ slug }}</code>
              </p>
            </div>
          </div>

          <!-- Footer: link a la guía completa. Cierra el drawer antes de
               navegar — si el usuario aterriza en /guia/:slug ya no necesita
               el drawer encima. -->
          <footer v-if="article" class="help-drawer__footer">
            <router-link
              :to="{ name: 'GuideArticle', params: { slug: article.slug } }"
              class="help-drawer__cta"
              @click="$emit('close')"
            >
              Ver guía completa →
            </router-link>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
// Convive con la guía existente: reusamos findArticle del data file
// para que el drawer y la vista /guia siempre muestren lo mismo.
import { findArticle, type GuideArticle } from '@/views/guide/guide.data'

const props = defineProps<{
  /** Slug del artículo a mostrar — debe existir en guide.data.ts */
  slug: string
  /** Controla la visibilidad del drawer */
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const article = computed<GuideArticle | undefined>(() => findArticle(props.slug))

// Bloqueo de scroll del body mientras el drawer está abierto. Mismo
// patrón que AppModal — evita que el usuario haga scroll del fondo
// y vea el contenido detrás del drawer cuando se mueve.
function lockScroll()   { document.body.style.overflow = 'hidden' }
function unlockScroll() { document.body.style.overflow = '' }

watch(() => props.open, v => { v ? lockScroll() : unlockScroll() }, { immediate: true })

// Escape cierra el drawer — accesibilidad básica de cualquier overlay.
// El listener vive en document para captar la tecla aunque el foco no
// esté dentro del drawer (caso típico tras tocar el backdrop sin click).
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}
onMounted(()   => document.addEventListener('keydown', onKeydown))
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); unlockScroll() })
</script>

<style scoped>
/* ── Backdrop: cubre toda la pantalla y centra el drawer a la derecha ─ */
.help-drawer-backdrop {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: flex-end;
  z-index: 1000;
}

.help-drawer {
  background: var(--color-surface);
  width: 100%;
  max-width: 380px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.25);
  border-left: 1px solid var(--color-border);
}

/* ── Header ──────────────────────────────────────────────────────── */
.help-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}
.help-drawer__heading { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.help-drawer__eyebrow {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  font-weight: 600;
}
.help-drawer__title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  line-height: 1.25;
}
.help-drawer__meta { font-size: 0.75rem; color: var(--color-text-muted); }

.help-drawer__close {
  width: 32px; height: 32px;
  border: none; background: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-text-muted);
  transition: background-color 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
}
.help-drawer__close:hover { background-color: var(--color-bg); color: var(--color-text); }

/* ── Body — render del artículo ──────────────────────────────────── */
.help-drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--color-text);
}

.help-drawer__summary {
  font-size: 0.95rem;
  font-style: italic;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-md);
  padding-bottom: var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.help-drawer__section { margin-bottom: var(--space-md); }
.help-drawer__h3 {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 8px;
}
.help-drawer__p { margin: 0 0 10px; }
.help-drawer__list { padding-left: 20px; margin: 8px 0 12px; }
.help-drawer__list li { margin-bottom: 6px; line-height: 1.45; }

/* Bloque de ejemplo numérico — mismo tono visual que la vista de guía */
.help-drawer__example {
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  margin: 10px 0 12px;
}
.help-drawer__example-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: 6px;
}
.help-drawer__example-body {
  font-family: var(--font-mono, 'Menlo', 'Consolas', monospace);
  font-size: 0.78rem;
  line-height: 1.5;
  white-space: pre-wrap;
  margin: 0;
  color: var(--color-text);
}

/* Callouts (info / tip / warn) */
.help-drawer__callout {
  display: flex; gap: 8px; align-items: flex-start;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  margin: 10px 0 12px;
  font-size: 0.85rem;
  line-height: 1.45;
}
.help-drawer__callout--info { background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; }
.help-drawer__callout--warn { background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; }
.help-drawer__callout--tip  { background: rgba(34, 197, 94, 0.08);  border-left: 3px solid #22c55e; }
.help-drawer__callout-icon { font-size: 1rem; flex-shrink: 0; line-height: 1.2; }

/* Fuentes — mismo patrón visual que GuideView pero más denso */
.help-drawer__sources {
  margin-top: var(--space-lg);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}
.help-drawer__sources-title { font-size: 0.85rem; font-weight: 700; margin: 0 0 8px; color: var(--color-text); }
.help-drawer__sources-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.help-drawer__source {
  display: flex; gap: 8px; align-items: center;
  padding: 8px 10px;
  background: var(--color-bg, var(--color-surface));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  text-decoration: none; color: inherit;
  font-size: 0.82rem;
  transition: border-color 0.15s ease;
}
.help-drawer__source:hover { border-color: var(--color-primary); }
.help-drawer__source-org {
  font-size: 0.65rem; font-weight: 700; padding: 2px 6px;
  border-radius: 3px; flex-shrink: 0; text-transform: uppercase;
  letter-spacing: 0.03em;
  background: var(--color-border); color: var(--color-text-muted);
}
.help-drawer__source-label { flex: 1; color: var(--color-text); }
.help-drawer__source-ext { color: var(--color-text-muted); }

/* Empty / 404 */
.help-drawer__empty {
  padding: var(--space-md);
  text-align: center;
  color: var(--color-text-muted);
}
.help-drawer__empty-hint code {
  font-family: var(--font-mono, 'Menlo', 'Consolas', monospace);
  font-size: 0.85rem;
  background: var(--color-border);
  padding: 2px 6px;
  border-radius: 3px;
}

/* ── Footer ───────────────────────────────────────────────────────── */
.help-drawer__footer {
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}
.help-drawer__cta {
  display: inline-block;
  width: 100%;
  text-align: center;
  padding: 10px 16px;
  background: var(--color-primary, #3b82f6);
  color: #fff;
  text-decoration: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: 0.9rem;
  transition: opacity 0.15s ease;
}
.help-drawer__cta:hover { opacity: 0.9; }

/* ── Animación de entrada/salida desde la derecha ─────────────────── */
.help-drawer-enter-active,
.help-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.help-drawer-enter-active .help-drawer,
.help-drawer-leave-active .help-drawer {
  transition: transform 0.25s ease;
}
.help-drawer-enter-from,
.help-drawer-leave-to { opacity: 0; }
.help-drawer-enter-from .help-drawer,
.help-drawer-leave-to .help-drawer { transform: translateX(100%); }

/* ── Mobile: drawer ocupa todo el ancho, sin max-width ────────────── */
@media (max-width: 640px) {
  .help-drawer { max-width: 100%; }
}
</style>
