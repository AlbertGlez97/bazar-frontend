<template>
  <!-- Átomo: toggle switch on/off con label opcional -->
  <label class="app-switch" :class="{ 'app-switch--disabled': disabled }">
    <input
      class="app-switch__input"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      v-bind="$attrs"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <!-- Track + thumb del toggle -->
    <span class="app-switch__track" aria-hidden="true">
      <span class="app-switch__thumb"></span>
    </span>
    <span v-if="$slots.default" class="app-switch__label"><slot /></span>
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
/* Mobile-first: switch 44×24 cumple Apple HIG. Desktop vuelve a 36×20. */
.app-switch {
  display:     inline-flex;
  align-items: center;
  gap:         0.625rem;
  cursor:      pointer;
  user-select: none;
  min-height:  2.75rem;                 /* área táctil */
  padding:     0.25rem 0;
}
.app-switch--disabled { opacity: .5; cursor: not-allowed; pointer-events: none; }

.app-switch__input { display: none; }

/* Track */
.app-switch__track {
  position:      relative;
  width:         2.75rem;               /* 44px */
  height:        1.5rem;                /* 24px */
  border-radius: var(--radius-full, 9999px);
  background:    var(--color-border);
  flex-shrink:   0;
  transition:    background var(--transition);
}
.app-switch__input:checked ~ .app-switch__track {
  background: var(--color-primary);
}

/* Thumb — mobile-first */
.app-switch__thumb {
  position:      absolute;
  top:           0.125rem;
  left:          0.125rem;
  width:         1.25rem;               /* 20px */
  height:        1.25rem;
  border-radius: 50%;
  background:    #fff;
  box-shadow:    0 1px 3px rgba(0,0,0,.2);
  transition:    transform var(--transition);
}
.app-switch__input:checked ~ .app-switch__track .app-switch__thumb {
  transform: translateX(1.25rem);       /* = width del thumb */
}

.app-switch__label { font-size: 0.9375rem; color: var(--color-text); }

/* Desktop: compactar el switch */
@media (min-width: 768px) {
  .app-switch        { min-height: auto; padding: 0; }
  .app-switch__track { width: 2.25rem; height: 1.25rem; }
  .app-switch__thumb { width: 1rem; height: 1rem; }
  .app-switch__input:checked ~ .app-switch__track .app-switch__thumb {
    transform: translateX(1rem);
  }
  .app-switch__label { font-size: 0.85rem; }
}
</style>
