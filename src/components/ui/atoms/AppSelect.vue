<template>
  <!-- Átomo: select nativo estilizado — idéntico en apariencia al AppInput -->
  <div
    class="app-select-wrap"
    :class="{ 'app-select-wrap--error': !!error, 'app-select-wrap--disabled': disabled }"
  >
    <label
      v-if="label"
      class="app-select__label"
    >{{ label }}</label>

    <div class="app-select__field-row">
      <select
        class="app-select"
        :class="`app-select--${size}`"
        :value="modelValue"
        :disabled="disabled"
        v-bind="$attrs"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      >
        <option
          v-if="placeholder"
          value=""
          disabled
        >
          {{ placeholder }}
        </option>
        <slot />
      </select>
      <!-- Flecha decorativa -->
      <span
        class="app-select__arrow"
        aria-hidden="true"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>

    <p
      v-if="error"
      class="app-select__error"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{
  modelValue?:  string | number
  label?:       string
  error?:       string
  placeholder?: string
  disabled?:    boolean
  size?:        'sm' | 'md' | 'lg'
}>(), {
  modelValue: '',
  disabled:   false,
  size:       'md',
})

defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<style scoped>
.app-select-wrap { display: flex; flex-direction: column; gap: 4px; }
.app-select__label { font-size: 0.8rem; font-weight: 500; color: var(--color-text-muted); }
.app-select__field-row { position: relative; display: flex; align-items: center; }

/* Base — mismo principio que AppInput: 16px mobile evita zoom iOS */
.app-select {
  width:         100%;
  appearance:    none;
  background:    var(--color-surface);
  border:        1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color:         var(--color-text);
  font-family:   inherit;
  font-size:     16px;
  padding:       0.625rem 2.25rem 0.625rem 0.875rem;
  min-height:    2.5rem;                      /* touch target base */
  transition:    border-color var(--transition), box-shadow var(--transition);
  outline:       none;
  cursor:        pointer;
  box-sizing:    border-box;
}
.app-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,.15);
}
.app-select:disabled { opacity: .5; cursor: not-allowed; }

.app-select--sm { padding: 0.5rem   2rem    0.5rem   0.75rem;  font-size: 16px; min-height: 2.25rem; }
.app-select--md { padding: 0.625rem 2.25rem 0.625rem 0.875rem; font-size: 16px; min-height: 2.5rem;  }
.app-select--lg { padding: 0.875rem 2.25rem 0.875rem 0.875rem; font-size: 16px; min-height: 3rem;    }

@media (min-width: 768px) {
  .app-select--sm { font-size: 0.8rem;  }
  .app-select--md { font-size: 0.88rem; }
  .app-select--lg { font-size: 0.93rem; }
}

.app-select__arrow {
  position:       absolute;
  right:          0.625rem;
  top:            50%;
  transform:      translateY(-50%);
  color:          var(--color-text-muted);
  pointer-events: none;
  display:        flex;
}

.app-select-wrap--error .app-select {
  border-color: var(--color-danger);
}
.app-select-wrap--error .app-select:focus {
  box-shadow: 0 0 0 3px rgba(239,68,68,.15);
}
.app-select__error { font-size: 0.8125rem; color: var(--color-danger); margin: 0; line-height: 1.3; }
.app-select-wrap--disabled { opacity: .6; }
</style>
