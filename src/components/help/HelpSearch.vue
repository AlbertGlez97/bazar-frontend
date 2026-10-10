<template>
  <div
    ref="root"
    class="help-search"
    role="search"
  >
    <AppInput
      :model-value="modelValue"
      type="search"
      label="Buscar en la ayuda"
      placeholder="Ej. cambio, billetes, abonos, etiquetas"
      autocomplete="off"
      :aria-describedby="statusId"
      size="lg"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #icon-left>
        <Search
          :size="20"
          aria-hidden="true"
        />
      </template>
    </AppInput>
    <AppButton
      v-if="modelValue"
      variant="secondary"
      data-action="clear-search"
      @click="emit('clear')"
    >
      Limpiar búsqueda
    </AppButton>
    <p
      :id="statusId"
      class="help-search__status"
      role="status"
      aria-live="polite"
    >
      {{ status }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { Search } from '@lucide/vue'
import AppButton from '@/components/ui/atoms/AppButton.vue'
import AppInput from '@/components/ui/molecules/AppInput.vue'

const props = defineProps<{
  modelValue: string
  /** Results for the current query; announced to assistive technology. */
  count: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; clear: [] }>()

const statusId = `help-search-status-${useId()}`
const root = ref<HTMLElement | null>(null)
const status = computed(() => {
  if (!props.modelValue.trim()) return ''
  return props.count === 1 ? '1 resultado' : `${props.count} resultados`
})

function focus() {
  root.value?.querySelector<HTMLInputElement>('input')?.focus()
}
defineExpose({ focus })
</script>

<style scoped>
.help-search { display: flex; flex-direction: column; gap: var(--spacing-sm); max-width: 45rem; }
.help-search :deep(input) { min-height: 44px; }
.help-search__status { margin: 0; min-height: 1.4em; color: var(--color-text-muted); font-size: var(--font-size-sm); }
</style>
