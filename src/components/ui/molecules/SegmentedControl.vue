<template>
  <!-- Molécula: control segmentado de opciones excluyentes (una activa a la vez),
       con palabras y botones grandes. Generaliza el selector Cuadrícula/Lista.
       Es presentacional: recibe la opción activa y emite la que se toca. Tono
       neutro a propósito: la opción activa se distingue por borde y peso de
       letra, no por el color fuerte de la acción principal de la pantalla. -->
  <div
    class="segmented-control"
    :class="`segmented-control--${size}`"
    role="group"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="segmented-control__btn"
      :data-value="option.value"
      :aria-pressed="option.value === modelValue"
      :disabled="disabled"
      @click="select(option.value)"
    >
      <span
        v-if="option.icon"
        aria-hidden="true"
      >{{ option.icon }}</span>
      <span class="segmented-control__label">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
export interface SegmentedOption {
  value: string
  label: string
  /** Decorativo: nunca reemplaza al texto. */
  icon?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: readonly SegmentedOption[]
  /** Nombre accesible del grupo. */
  label: string
  /** `lg` (56 px) para pantallas de poca experiencia con tecnología. */
  size?: 'md' | 'lg'
  disabled?: boolean
}>(), { size: 'md', disabled: false })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

/** Tocar la opción que ya está activa no cambia nada, así que no emite. */
function select(value: string) {
  if (props.disabled || value === props.modelValue) return
  emit('update:modelValue', value)
}
</script>

<style scoped>
.segmented-control {
  display: flex;
  gap: var(--spacing-xs);
  width: 100%;
  min-width: 0;
  padding: var(--spacing-xs);
  background: var(--color-surface-alt);
  border-radius: var(--radius-lg);
}
.segmented-control__btn {
  display: inline-flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 2.75rem;
  padding: 0 var(--spacing-sm);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
  color: var(--color-text);
  background: transparent;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
}
.segmented-control__label { overflow-wrap: anywhere; }
.segmented-control__btn:hover:not(:disabled) { background: var(--color-surface); }
.segmented-control__btn[aria-pressed='true'] {
  font-weight: 800;
  background: var(--color-surface);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-sm);
}
.segmented-control__btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }
.segmented-control__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.segmented-control--lg .segmented-control__btn {
  min-height: 3.5rem;
  font-size: var(--font-size-md);
}
</style>
