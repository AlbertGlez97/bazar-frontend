<template>
  <!-- Átomo: campo de texto con soporte de label, error, íconos y tamaños -->
  <div
    class="app-input-wrap"
    :class="{ 'app-input-wrap--error': !!error, 'app-input-wrap--disabled': disabled }"
  >
    <!-- Label opcional -->
    <label
      v-if="label"
      class="app-input__label"
      :for="fieldId()"
    >{{ label }}</label>

    <div class="app-input__field-row">
      <!-- Ícono izquierdo (slot) -->
      <span
        v-if="$slots['icon-left']"
        class="app-input__icon app-input__icon--left"
      >
        <slot name="icon-left" />
      </span>

      <!-- Input nativo -->
      <input
        class="app-input"
        :class="[
          `app-input--${size}`,
          { 'app-input--icon-left': !!$slots['icon-left'] },
          { 'app-input--icon-right': !!$slots['icon-right'] },
        ]"
        :type="type"
        :value="modelValue"
        :disabled="disabled"
        :placeholder="placeholder"
        v-bind="{ ...$attrs, id: fieldId() }"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      >

      <!-- Ícono derecho (slot) — se usa para toggle de password, iconos de estado, etc. -->
      <span
        v-if="$slots['icon-right']"
        class="app-input__icon app-input__icon--right"
      >
        <slot name="icon-right" />
      </span>
    </div>

    <!-- Mensaje de error -->
    <p
      v-if="error"
      class="app-input__error"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { useAttrs } from 'vue'
import { useFieldId } from '@/composables/useFieldId'

// Desactiva herencia automática de attrs para evitar duplicar atributos en el wrapper
defineOptions({ inheritAttrs: false })

// id que enlaza <label for> con el <input> (explícito del padre o generado)
const fieldId = useFieldId(useAttrs())

withDefaults(defineProps<{
  modelValue?:  string | number
  label?:       string
  error?:       string
  placeholder?: string
  type?:        string
  disabled?:    boolean
  size?:        'sm' | 'md' | 'lg'
}>(), {
  modelValue:  '',
  label:       undefined,
  error:       undefined,
  placeholder: undefined,
  type:        'text',
  disabled:    false,
  size:        'md',
})

defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<style scoped>
.app-input-wrap { display: flex; flex-direction: column; gap: 4px; }

/* Label */
.app-input__label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

/* Fila de campo + íconos */
.app-input__field-row { position: relative; display: flex; align-items: center; }

/* Input base — mobile-first.
   font-size: 16px en mobile es REQUISITO iOS: cualquier valor menor dispara
   zoom automático al hacer focus. En desktop volvemos a tamaños compactos. */
.app-input {
  width:            100%;
  background:       var(--color-surface);
  border:           1px solid var(--color-border);
  border-radius:    var(--radius-sm);
  color:            var(--color-text);
  font-family:      inherit;
  font-size:        16px;
  padding:          0.625rem 0.875rem;
  min-height:       2.5rem;              /* 40px touch target base */
  transition:       border-color var(--transition), box-shadow var(--transition);
  outline:          none;
  box-sizing:       border-box;
}
.app-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37,99,235,.15);
}
.app-input::placeholder { color: var(--color-text-muted); opacity: .7; }
.app-input:disabled     { opacity: .5; cursor: not-allowed; }

/* Tamaños — mobile mantiene 16px para evitar zoom, ajusta solo padding/height */
.app-input--sm { padding: 0.5rem   0.75rem;  font-size: 16px; min-height: 2.25rem; }
.app-input--md { padding: 0.625rem 0.875rem; font-size: 16px; min-height: 2.5rem;  }
.app-input--lg { padding: 0.875rem 1rem;     font-size: 16px; min-height: 3rem;    }

/* Desktop: sin riesgo de zoom iOS — volvemos a tipografía compacta */
@media (min-width: 768px) {
  .app-input--sm { font-size: 0.8rem;  }
  .app-input--md { font-size: 0.88rem; }
  .app-input--lg { font-size: 0.93rem; }
}

/* Íconos — offsets en rem para escalar con preferencias del usuario */
.app-input--icon-left  { padding-left:  2.25rem; }
.app-input--icon-right { padding-right: 2.25rem; }
.app-input--lg.app-input--icon-left  { padding-left:  2.5rem; }
.app-input--lg.app-input--icon-right { padding-right: 2.5rem; }

/* Contenedor de ícono */
.app-input__icon {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
  pointer-events: none;
}
.app-input__icon--left  { left:  0.625rem; }
.app-input__icon--right {
  right: 0.625rem;
  pointer-events: auto; /* el slot derecho puede tener botones clickeables */
}

/* Estado de error */
.app-input-wrap--error .app-input {
  border-color: var(--color-danger);
}
.app-input-wrap--error .app-input:focus {
  box-shadow: 0 0 0 3px rgba(239,68,68,.15);
}
.app-input__error {
  font-size: 0.8125rem;   /* 13px — mejor legibilidad mobile */
  color: var(--color-danger);
  margin: 0;
  line-height: 1.3;
}

/* Estado deshabilitado */
.app-input-wrap--disabled { opacity: .6; }
</style>
