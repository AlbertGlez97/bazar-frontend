<template>
  <!-- Molécula: modal accesible con backdrop, título, body y footer configurables -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="app-modal-backdrop"
        role="dialog"
        :aria-modal="true"
        :aria-labelledby="titleId"
        @click.self="onBackdropClick"
      >
        <div
          ref="modalElement"
          class="app-modal"
          :class="`app-modal--${size}`"
          :tabindex="manageFocus ? -1 : undefined"
        >
          <!-- Header -->
          <div class="app-modal__header">
            <div>
              <h2
                :id="titleId"
                class="app-modal__title"
              >
                {{ title }}
              </h2>
              <p
                v-if="subtitle"
                class="app-modal__subtitle"
              >
                {{ subtitle }}
              </p>
            </div>
            <button
              v-if="!hideClose"
              type="button"
              class="app-modal__close"
              aria-label="Cerrar"
              @click="close"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
              >
                <line
                  x1="18"
                  y1="6"
                  x2="6"
                  y2="18"
                /><line
                  x1="6"
                  y1="6"
                  x2="18"
                  y2="18"
                />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="app-modal__body">
            <slot />
          </div>

          <!-- Footer (slot o botones por defecto) -->
          <div
            v-if="$slots.footer || !hideFooter"
            class="app-modal__footer"
          >
            <slot name="footer">
              <button
                class="btn btn-ghost"
                @click="close"
              >
                Cancelar
              </button>
              <button
                class="btn btn-primary"
                @click="emit('confirm')"
              >
                {{ confirmLabel }}
              </button>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useId, onMounted, onUnmounted, watch, ref, nextTick } from 'vue'
import { hasOpenModal, isTopModal, popModal, pushModal } from '@/composables/useModalStack'

const props = withDefaults(defineProps<{
  modelValue:    boolean
  title:         string
  subtitle?:     string
  size?:         'sm' | 'md' | 'lg'
  hideClose?:    boolean
  hideFooter?:   boolean
  confirmLabel?: string
  closeOnBackdrop?: boolean
  manageFocus?: boolean
}>(), {
  subtitle:         undefined,
  size:             'md',
  hideClose:        false,
  hideFooter:       false,
  confirmLabel:     'Confirmar',
  closeOnBackdrop:  true,
  manageFocus:      false,
})

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  confirm:             []
}>()

const titleId = useId()
const modalElement = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null
const focusSelector = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
function focusable() {
  return [...(modalElement.value?.querySelectorAll<HTMLElement>(focusSelector) ?? [])]
    .filter(el => !el.closest('[hidden], [inert]') && el.tabIndex >= 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden')
}
function restoreFocus() {
  if (returnFocus?.isConnected) returnFocus.focus()
  returnFocus = null
}
watch(() => props.modelValue, async open => {
  if (!props.manageFocus) return
  if (!open) { restoreFocus(); return }
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  if (!props.modelValue) return
  const targets = focusable()
  const firstField = targets.find(el => el.matches('input, select, textarea'))
  ;(firstField ?? targets[0] ?? modalElement.value)?.focus()
}, { immediate: true })

function close()  { emit('update:modelValue', false) }
function onBackdropClick() { if (props.closeOnBackdrop) close() }

// Bloquear scroll del body mientras haya algún modal abierto: con dos apilados, cerrar el
// de arriba no lo libera (lo libera el último en cerrarse).
const stackId = Symbol('modal')
function lockScroll()   { document.body.style.overflow = 'hidden' }
function unlockScroll() { if (!hasOpenModal()) document.body.style.overflow = '' }

watch(() => props.modelValue, v => {
  if (v) { pushModal(stackId); lockScroll() } else { popModal(stackId); unlockScroll() }
}, { immediate: true })

// Cerrar con Escape (solo el modal de arriba atiende el teclado)
function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue || !isTopModal(stackId)) return
  if (e.key === 'Escape') close()
  if (!props.manageFocus || e.key !== 'Tab') return
  const targets = focusable(), first = targets[0], last = targets.at(-1)
  if (!first || !last) { e.preventDefault(); modalElement.value?.focus(); return }
  const active = document.activeElement
  if (active === modalElement.value || !modalElement.value?.contains(active) || (e.shiftKey ? active === first : active === last)) {
    e.preventDefault()
    ;(e.shiftKey ? last : first).focus()
  }
}
onMounted(()   => document.addEventListener('keydown', onKeydown))
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); popModal(stackId); unlockScroll(); restoreFocus() })
</script>

<style scoped>
.app-modal-backdrop {
  position: fixed; inset: 0;
  background: var(--color-overlay);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
  z-index: 1000;
}

.app-modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.app-modal--sm { max-width: 23.75rem; }
.app-modal--md { max-width: 30rem; }
.app-modal--lg { max-width: 38.75rem; }

.app-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  gap: var(--spacing-sm);
}
.app-modal__title    { font-size: 0.9375rem; font-weight: 600; color: var(--color-text); margin: 0; }
.app-modal__subtitle { font-size: var(--font-size-xs); color: var(--color-text-muted); margin: 3px 0 0; }
.app-modal__close {
  width: 28px; height: 28px;
  border: none; background: none;
  cursor: pointer;
  border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  color: var(--color-text-muted);
  transition: background var(--transition), color var(--transition);
  flex-shrink: 0;
}
.app-modal__close:hover { background: var(--color-bg); color: var(--color-text); }

.app-modal__body {
  padding: var(--spacing-lg);
  overflow-y: auto;
  flex: 1;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.app-modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg);
}

/* Transición */
.modal-enter-active, .modal-leave-active { transition: opacity .2s ease; }
.modal-enter-active .app-modal, .modal-leave-active .app-modal {
  transition: transform .2s cubic-bezier(.34,1.56,.64,1), opacity .15s ease;
}
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .app-modal, .modal-leave-to .app-modal {
  transform: scale(.95) translateY(8px);
  opacity: 0;
}
</style>
