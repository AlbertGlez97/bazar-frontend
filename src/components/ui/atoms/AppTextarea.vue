<template>
  <!-- Átomo: área de texto multilínea — mismo look&feel que AppInput -->
  <div
    class="app-textarea-wrap"
    :class="{ 'app-textarea-wrap--error': !!error, 'app-textarea-wrap--disabled': disabled }"
  >
    <!-- Label opcional -->
    <label
      v-if="label"
      class="app-textarea__label"
      :for="fieldId()"
    >{{ label }}</label>

    <textarea
      class="app-textarea"
      :value="modelValue"
      :disabled="disabled"
      :placeholder="placeholder"
      :rows="rows"
      v-bind="{ ...$attrs, id: fieldId() }"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />

    <!-- Mensaje de error -->
    <p
      v-if="error"
      class="app-textarea__error"
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

// id que enlaza <label for> con el <textarea> (explícito del padre o generado)
const fieldId = useFieldId(useAttrs())

withDefaults(defineProps<{
  modelValue?:  string
  label?:       string
  error?:       string
  placeholder?: string
  disabled?:    boolean
  rows?:        number
}>(), {
  modelValue:  '',
  label:       undefined,
  error:       undefined,
  placeholder: undefined,
  disabled:    false,
  rows:        4,
})

defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<style scoped>
.app-textarea-wrap { display: flex; flex-direction: column; gap: 4px; }

.app-textarea__label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

/* Textarea base — font-size 16px en mobile evita zoom automático en iOS,
   igual que en AppInput. */
.app-textarea {
  width:            100%;
  background:       var(--color-surface);
  border:           1px solid var(--color-border-strong);
  border-radius:    var(--radius-sm);
  color:            var(--color-text);
  font-family:      inherit;
  font-size:        16px;
  padding:          0.625rem 0.875rem;
  resize:           vertical;
  min-height:       6rem;
  transition:       border-color var(--transition), box-shadow var(--transition);
  outline:          none;
  box-sizing:       border-box;
}
.app-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent);
}
.app-textarea::placeholder { color: var(--color-text-subtle); opacity: 1; }
.app-textarea:disabled     { opacity: .5; cursor: not-allowed; }

@media (min-width: 768px) {
  .app-textarea { font-size: 0.88rem; }
}

/* Estado de error */
.app-textarea-wrap--error .app-textarea { border-color: var(--color-danger); }
.app-textarea-wrap--error .app-textarea:focus {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-danger) 22%, transparent);
}
.app-textarea__error {
  font-size: 0.8125rem;
  color: var(--color-danger);
  margin: 0;
  line-height: 1.3;
}

.app-textarea-wrap--disabled { opacity: .6; }
</style>
