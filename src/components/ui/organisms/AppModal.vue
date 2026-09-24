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
          class="app-modal"
          :class="`app-modal--${size}`"
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
import { useId, onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue:    boolean
  title:         string
  subtitle?:     string
  size?:         'sm' | 'md' | 'lg'
  hideClose?:    boolean
  hideFooter?:   boolean
  confirmLabel?: string
  closeOnBackdrop?: boolean
}>(), {
  subtitle:         undefined,
  size:             'md',
  hideClose:        false,
  hideFooter:       false,
  confirmLabel:     'Confirmar',
  closeOnBackdrop:  true,
})

const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  confirm:             []
}>()

const titleId = useId()

function close()  { emit('update:modelValue', false) }
function onBackdropClick() { if (props.closeOnBackdrop) close() }

// Bloquear scroll del body mientras el modal está abierto
function lockScroll()   { document.body.style.overflow = 'hidden' }
function unlockScroll() { document.body.style.overflow = '' }

watch(() => props.modelValue, v => { if (v) lockScroll(); else unlockScroll() }, { immediate: true })

// Cerrar con Escape
function onKeydown(e: KeyboardEvent) { if (e.key === 'Escape') close() }
onMounted(()   => document.addEventListener('keydown', onKeydown))
onUnmounted(() => { document.removeEventListener('keydown', onKeydown); unlockScroll() })
</script>

<style scoped>
.app-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(15,23,42,.55);
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
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(0,0,0,.05);
  width: 100%;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.app-modal--sm { max-width: 380px; }
.app-modal--md { max-width: 480px; }
.app-modal--lg { max-width: 620px; }

.app-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  gap: var(--spacing-sm);
}
.app-modal__title    { font-size: 15px; font-weight: 600; color: var(--color-text); margin: 0; }
.app-modal__subtitle { font-size: 12px; color: var(--color-text-muted); margin: 3px 0 0; }
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
  font-size: 13px;
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
