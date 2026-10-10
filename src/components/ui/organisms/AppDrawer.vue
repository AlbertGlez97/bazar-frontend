<template>
  <!-- Organismo: cajón lateral derecho (hoja a pantalla completa en celular).
       Teleport a body, diálogo modal, trampa de foco, Escape, retorno de foco y
       bloqueo del scroll del documento. -->
  <Teleport to="body">
    <Transition name="app-drawer">
      <div
        v-if="modelValue"
        class="app-drawer-root"
      >
        <div
          class="app-drawer__backdrop"
          @click="close"
        />
        <div
          ref="panel"
          class="app-drawer"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
        >
          <header class="app-drawer__header">
            <h2
              :id="titleId"
              class="app-drawer__title"
            >
              <slot name="title">
                {{ title }}
              </slot>
            </h2>
            <button
              type="button"
              class="app-drawer__close"
              :aria-label="closeLabel"
              @click="close"
            >
              <X
                :size="20"
                aria-hidden="true"
              />
            </button>
          </header>
          <div class="app-drawer__body">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="app-drawer__footer"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { X } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  /** Accessible name of the dialog (also its visible heading unless the `title` slot is used). */
  title: string
  closeLabel?: string
  /**
   * Element that receives focus when the drawer closes. Defaults to whatever had
   * focus when it opened; pass the opener for browsers that do not focus buttons on click.
   */
  returnFocus?: HTMLElement | null
}>(), {
  closeLabel: 'Cerrar',
  returnFocus: null,
})

const emit = defineEmits<{ 'update:modelValue': [open: boolean] }>()

const titleId = useId()
const panel = ref<HTMLElement | null>(null)
let opener: HTMLElement | null = null
let previousOverflow: string | null = null

// The trap mirrors AppModal's (manage-focus). It is not shared on purpose: AppModal
// keeps its own opt-in behavior and this drawer always traps.
const focusSelector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
function focusable(): HTMLElement[] {
  return [...(panel.value?.querySelectorAll<HTMLElement>(focusSelector) ?? [])]
    .filter((el) => !el.closest('[hidden], [inert]') && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none')
}

function close() { emit('update:modelValue', false) }

function lockScroll() {
  if (previousOverflow === null) previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}
function unlockScroll() {
  if (previousOverflow === null) return
  document.body.style.overflow = previousOverflow
  previousOverflow = null
}
function restoreFocus() {
  const target = props.returnFocus?.isConnected ? props.returnFocus : opener
  if (target?.isConnected) target.focus()
  opener = null
}

let wasOpen = false
watch(() => props.modelValue, async (open) => {
  if (open === wasOpen) return
  wasOpen = open
  if (open) {
    opener = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null
    lockScroll()
    await nextTick()
    if (!props.modelValue) return
    ;(focusable()[0] ?? panel.value)?.focus()
  } else {
    unlockScroll()
    await nextTick()
    restoreFocus()
  }
}, { immediate: true })

function onKeydown(event: KeyboardEvent) {
  if (!props.modelValue) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab') return
  const targets = focusable()
  const first = targets[0]
  const last = targets.at(-1)
  if (!first || !last) { event.preventDefault(); panel.value?.focus(); return }
  const active = document.activeElement
  const outside = !panel.value?.contains(active) || active === panel.value
  if (outside || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  }
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  unlockScroll()
  if (props.modelValue) restoreFocus()
})
</script>

<style scoped>
.app-drawer-root { position: fixed; inset: 0; z-index: 1000; display: flex; justify-content: flex-end; }
.app-drawer__backdrop { position: absolute; inset: 0; background: var(--color-overlay); }

.app-drawer {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(28rem, 100vw);
  height: 100%;
  max-height: 100dvh;
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  border-left: 1px solid var(--color-border);
}
.app-drawer:focus { outline: none; }

.app-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-md) var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}
.app-drawer__title { font-size: var(--font-size-lg); margin: 0; min-width: 0; overflow-wrap: anywhere; }
.app-drawer__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  min-width: 44px;
  min-height: 44px;
  margin: -0.25rem -0.5rem 0 0;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  transition: background var(--motion-fast) var(--motion-ease), color var(--motion-fast) var(--motion-ease);
}
.app-drawer__close:hover { background: var(--color-bg); color: var(--color-text); }

.app-drawer__body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: var(--spacing-md); }
.app-drawer__footer {
  padding: var(--spacing-md);
  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
}

/* Entrada: el fondo se desvanece y el cajón se desliza desde la derecha. */
.app-drawer-enter-active, .app-drawer-leave-active { transition: opacity var(--motion-slow) var(--motion-ease); }
.app-drawer-enter-active .app-drawer, .app-drawer-leave-active .app-drawer {
  transition: transform var(--motion-slow) var(--motion-ease), opacity var(--motion-slow) var(--motion-ease);
}
.app-drawer-enter-from, .app-drawer-leave-to { opacity: 0; }
.app-drawer-enter-from .app-drawer, .app-drawer-leave-to .app-drawer { transform: translateX(2rem); opacity: 0; }

/* Celular: hoja a pantalla completa. */
@media (max-width: 767px) {
  .app-drawer { width: 100%; border-left: none; }
}

@media (prefers-reduced-motion: reduce) {
  .app-drawer-enter-active, .app-drawer-leave-active,
  .app-drawer-enter-active .app-drawer, .app-drawer-leave-active .app-drawer { transition: none; }
  .app-drawer-enter-from .app-drawer, .app-drawer-leave-to .app-drawer { transform: none; }
}
</style>
