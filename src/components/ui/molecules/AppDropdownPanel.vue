<template>
  <!--
    Molécula: contenedor desplegable genérico (no sabe qué lleva dentro).

    Pantalla ancha: panel anclado al disparador. Tablet y celular: hoja desde
    abajo con telón. Se cierra con clic fuera, con Escape y con su botón de
    cerrar. El foco entra al abrir, se queda dentro con Tab / Shift+Tab y
    vuelve al disparador al cerrar.

    El disparador lo pone quien usa el componente (slot `trigger`) y recibe en
    `attrs` lo que necesita para ser accesible: aria-expanded, aria-controls,
    aria-haspopup y el clic que abre/cierra.
  -->
  <div
    ref="rootRef"
    class="app-dropdown-panel"
  >
    <slot
      name="trigger"
      :attrs="triggerAttrs"
      :open="modelValue"
    />

    <div
      v-if="modelValue && isSheet"
      class="app-dropdown-panel__backdrop"
      @click="close()"
    />

    <div
      v-if="modelValue"
      :id="panelId"
      ref="surfaceRef"
      class="app-dropdown-panel__surface"
      :class="[
        isSheet ? 'app-dropdown-panel__surface--sheet' : 'app-dropdown-panel__surface--popover',
        `app-dropdown-panel__surface--align-${align}`,
      ]"
      role="dialog"
      :aria-label="title"
      tabindex="-1"
      @keydown="onSurfaceKeydown"
    >
      <div class="app-dropdown-panel__header">
        <h2 class="app-dropdown-panel__title">
          {{ title }}
        </h2>
        <button
          type="button"
          class="app-dropdown-panel__close"
          :aria-label="closeLabel"
          @click="close()"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div class="app-dropdown-panel__body">
        <slot />
      </div>

      <div
        v-if="$slots.footer"
        class="app-dropdown-panel__footer"
      >
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useMediaQuery } from '@/composables/useMediaQuery'

const props = withDefaults(defineProps<{
  modelValue: boolean
  /** Nombre accesible del diálogo y título visible del panel. */
  title: string
  closeLabel: string
  /** Borde del disparador al que se alinea el panel en pantalla ancha. */
  align?: 'start' | 'end'
}>(), { align: 'start' })

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

// Tablet y celular: hoja desde abajo.
const isSheet = useMediaQuery('(max-width: 1023px)')

const panelId = useId()
const rootRef = ref<HTMLElement | null>(null)
const surfaceRef = ref<HTMLElement | null>(null)

const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function focusable(): HTMLElement[] {
  return Array.from(surfaceRef.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
}

let returnFocus: HTMLElement | null = null
let restoreOnClose = true

/** `restoreFocus` es falso al cerrar con un clic fuera: el foco ya fue a donde la persona tocó. */
function close(restoreFocus = true) {
  restoreOnClose = restoreFocus
  emit('update:modelValue', false)
}

function toggle() {
  if (props.modelValue) close()
  else emit('update:modelValue', true)
}

const triggerAttrs = computed(() => ({
  'aria-haspopup': 'dialog',
  'aria-expanded': String(props.modelValue),
  'aria-controls': panelId,
  onClick: toggle,
}))

function onDocumentClick(event: MouseEvent) {
  const root = rootRef.value
  if (root && event.target instanceof Node && !root.contains(event.target)) close(false)
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

/** Mantiene Tab / Shift+Tab dentro del panel. */
function onSurfaceKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const items = focusable()
  if (items.length === 0) {
    event.preventDefault()
    return
  }
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === surfaceRef.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function bind() {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
}
function unbind() {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    bind()
    await nextTick()
    surfaceRef.value?.focus()
    return
  }
  unbind()
  if (restoreOnClose && returnFocus?.isConnected) returnFocus.focus()
  returnFocus = null
  restoreOnClose = true
}, { immediate: true })

onBeforeUnmount(unbind)
</script>

<style scoped>
.app-dropdown-panel {
  position: relative;
  display: inline-block;
}

.app-dropdown-panel__surface {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-pop);
  color: var(--color-text);
}
.app-dropdown-panel__surface:focus { outline: none; }

/* ── Pantalla ancha: anclado al disparador ─────────────────────────── */
.app-dropdown-panel__surface--popover {
  position: absolute;
  top: calc(100% + 0.5rem);
  z-index: 200;
  width: max-content;
  min-width: 18rem;
  max-width: min(24rem, 90vw);
  max-height: min(70vh, 32rem);
  border-radius: var(--radius-lg);
}
.app-dropdown-panel__surface--align-start { left: 0; }
.app-dropdown-panel__surface--align-end { right: 0; }

/* ── Tablet y celular: hoja desde abajo ────────────────────────────── */
.app-dropdown-panel__backdrop {
  position: fixed;
  inset: 0;
  z-index: 290;
  background: var(--color-overlay);
}
.app-dropdown-panel__surface--sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 300;
  max-height: 85vh;
  padding-bottom: env(safe-area-inset-bottom, 0);
  border-width: 1px 0 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.app-dropdown-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
}
.app-dropdown-panel__title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 700;
}
.app-dropdown-panel__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.75rem;
  min-height: 2.75rem;
  margin: -0.5rem -0.75rem -0.5rem 0;
  font-family: inherit;
  font-size: var(--font-size-lg);
  line-height: 1;
  color: var(--color-text-muted);
  background: transparent;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.app-dropdown-panel__close:hover { color: var(--color-text); }
.app-dropdown-panel__close:focus-visible {
  outline: 3px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.app-dropdown-panel__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: var(--spacing-md) var(--spacing-lg);
}
.app-dropdown-panel__footer {
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
}
</style>
