<template>
  <!-- Organismo: selector Venta / Gestión con aviso NO bloqueante.
       Es organismo (y no molécula) porque incluye AppModal, y las moléculas no
       pueden importar organismos. No accede a stores (regla del barrel): recibe
       el modo por v-model y quien lo usa (AppLayout) lo conecta al store. -->
  <div
    class="ui-mode-switch"
    :class="[`ui-mode-switch--${tone}`, { 'ui-mode-switch--compact': compact }]"
  >
    <div
      class="ui-mode-switch__group"
      role="group"
      aria-label="Modo de la aplicación"
    >
      <button
        v-for="option in options"
        :key="option.mode"
        type="button"
        class="ui-mode-switch__btn"
        :class="{ 'ui-mode-switch__btn--active': modelValue === option.mode }"
        :aria-pressed="modelValue === option.mode"
        :aria-label="`Modo ${option.label}`"
        :title="`Modo ${option.label}`"
        @click="select(option.mode)"
      >
        <span
          class="ui-mode-switch__icon"
          aria-hidden="true"
        >{{ option.icon }}</span>
        <span
          v-if="!compact"
          class="ui-mode-switch__label"
        >{{ option.label }}</span>
      </button>
    </div>

    <!-- Aviso no bloqueante: explica, ofrece dos salidas claras y respeta la
         decisión. Cerrarlo (Escape o tocar fuera) equivale a "Mejor no". -->
    <AppModal
      v-model="warningOpen"
      title="¿Seguro que quieres entrar a Gestión?"
      size="sm"
      hide-close
    >
      Estás en una pantalla chica y táctil. Gestión sirve para administrar el
      catálogo y se trabaja mucho mejor desde una computadora. Si lo necesitas,
      puedes entrar de todos modos y volver a Venta cuando quieras.
      <template #footer>
        <div class="ui-mode-switch__actions">
          <AppButton
            variant="secondary"
            size="lg"
            @click="confirmGestion"
          >
            Entiendo, quiero seguir
          </AppButton>
          <AppButton
            variant="primary"
            size="lg"
            @click="warningOpen = false"
          >
            Mejor no
          </AppButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDeviceCapabilities } from '@/composables/useDeviceCapabilities'
import type { UiMode } from '@/types/ui-mode.types'
import AppButton from '../atoms/AppButton.vue'
import AppModal from './AppModal.vue'

const props = withDefaults(defineProps<{
  /** Modo activo (v-model) */
  modelValue: UiMode
  /** Solo íconos, apilados: para la barra lateral colapsada (los nombres accesibles se conservan) */
  compact?: boolean
  /** `inverse` para fondos oscuros (barra lateral) */
  tone?: 'light' | 'inverse'
}>(), {
  compact: false,
  tone: 'light',
})

const emit = defineEmits<{
  'update:modelValue': [mode: UiMode]
}>()

const options: { mode: UiMode; label: string; icon: string }[] = [
  { mode: 'venta', label: 'Venta', icon: '🛒' },
  { mode: 'gestion', label: 'Gestión', icon: '⚙️' },
]

// Se lee EN EL MOMENTO de cambiar (refs reactivas), no al montar: si la
// tablet gira o cambia el tamaño de la ventana, el aviso responde a lo actual.
const { isTouchDevice, isSmallScreen } = useDeviceCapabilities()
const warningOpen = ref(false)

function select(mode: UiMode) {
  if (mode === props.modelValue) return
  // Solo se avisa al ir a Gestión desde un dispositivo táctil de pantalla
  // pequeña. Ir a Venta nunca avisa, desde cualquier dispositivo. El aviso no
  // impide nada: la decisión es de la persona.
  if (mode === 'gestion' && isTouchDevice.value && isSmallScreen.value) {
    warningOpen.value = true
    return
  }
  emit('update:modelValue', mode)
}

function confirmGestion() {
  warningOpen.value = false
  emit('update:modelValue', 'gestion')
}
</script>

<style scoped>
.ui-mode-switch__group {
  display: flex;
  gap: var(--spacing-xs);
}

/* Objetivo táctil mínimo de 44x44 px (guía de marca, sección "Interacción") */
.ui-mode-switch__btn {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  min-height: 44px;
  min-width: 44px;
  padding: 0 var(--spacing-md);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition), color var(--transition), border-color var(--transition);
}
.ui-mode-switch__btn:hover:not(.ui-mode-switch__btn--active) {
  background: var(--color-surface-alt);
  color: var(--color-text);
}
.ui-mode-switch__btn--active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--color-on-primary);
  cursor: default;
}
.ui-mode-switch__icon { font-size: 18px; line-height: 1; }

/* Compacto: columna de íconos de 44x44 (barra lateral colapsada) */
.ui-mode-switch--compact .ui-mode-switch__group { flex-direction: column; align-items: center; }
.ui-mode-switch--compact .ui-mode-switch__btn {
  flex: 0 0 auto;
  width: 44px;
  padding: 0;
}

/* Sobre fondo oscuro (barra lateral): mismos tokens que los enlaces del menú */
.ui-mode-switch--inverse .ui-mode-switch__btn {
  background: transparent;
  border-color: color-mix(in srgb, var(--color-sidebar-text) 30%, transparent);
  color: var(--color-sidebar-text);
}
.ui-mode-switch--inverse .ui-mode-switch__btn:hover:not(.ui-mode-switch__btn--active) {
  background: color-mix(in srgb, var(--color-sidebar-text) 10%, transparent);
  color: var(--color-surface);
}
.ui-mode-switch--inverse .ui-mode-switch__btn--active {
  background: color-mix(in srgb, var(--color-sidebar-active) 18%, transparent);
  border-color: var(--color-sidebar-active);
  color: var(--color-surface);
}
.ui-mode-switch--inverse .ui-mode-switch__btn:focus-visible {
  outline-color: var(--color-sidebar-active);
}

/* Botones del aviso: envuelven en pantallas angostas en vez de desbordar */
.ui-mode-switch__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  width: 100%;
}
.ui-mode-switch__actions > * { flex: 1 1 10rem; }
</style>
