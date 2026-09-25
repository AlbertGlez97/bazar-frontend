<template>
  <!-- Átomo: checkbox estilizado con label -->
  <label
    class="app-checkbox"
    :class="{ 'app-checkbox--disabled': disabled }"
  >
    <input
      class="app-checkbox__input"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      v-bind="$attrs"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    >
    <!-- Ícono de check personalizado -->
    <span
      class="app-checkbox__box"
      aria-hidden="true"
    >
      <svg
        v-if="modelValue"
        width="10"
        height="10"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="2 6 5 9 10 3" />
      </svg>
    </span>
    <span
      v-if="$slots.default"
      class="app-checkbox__label"
    ><slot /></span>
  </label>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  modelValue?: boolean
  disabled?:   boolean
}>(), { modelValue: false, disabled: false })

defineEmits<{ 'update:modelValue': [v: boolean] }>()
</script>

<style scoped>
/* Mobile-first: área táctil ≥ 44px. En desktop volvemos compacto. */
.app-checkbox {
  display:     inline-flex;
  align-items: center;
  gap:         0.625rem;
  cursor:      pointer;
  user-select: none;
  min-height:  2.75rem;                  /* 44px Apple HIG / Material 48dp */
  padding:     0.25rem 0;
}
.app-checkbox--disabled { opacity: .5; cursor: not-allowed; pointer-events: none; }

.app-checkbox__input { display: none; }

.app-checkbox__box {
  width:         1.25rem;                /* 20px — antes 16 */
  height:        1.25rem;
  border:        1.5px solid var(--color-border-strong);
  border-radius: 0.25rem;
  background:    var(--color-surface);
  flex-shrink:   0;
  display:       flex;
  align-items:   center;
  justify-content: center;
  transition:    background var(--transition), border-color var(--transition);
}
.app-checkbox__input:checked ~ .app-checkbox__box {
  color:        var(--color-on-primary);
  background:   var(--color-primary);
  border-color: var(--color-primary);
}

.app-checkbox__label {
  font-size:   0.9375rem;                /* 15px — cómodo en mobile */
  color:       var(--color-text);
  line-height: 1.35;
}

/* Desktop: sin problema de touch, volvemos a tamaño visual compacto */
@media (min-width: 768px) {
  .app-checkbox     { min-height: auto; padding: 0; gap: 0.5rem; }
  .app-checkbox__box { width: 1rem; height: 1rem; border-width: 1px; }
  .app-checkbox__label { font-size: 0.85rem; line-height: 1.3; }
}
</style>
