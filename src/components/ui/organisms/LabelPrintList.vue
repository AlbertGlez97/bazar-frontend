<template>
  <!-- Organismo: lista de impresión de códigos QR (D2). Estado transitorio del
       contenedor (nunca un store): cada fila es un producto agregado con su
       conteo de copias. Presentacional: recibe las filas y emite lo que la
       persona quiere hacer; el resumen usa `sheetCount` (mismo plan que el
       PDF), nunca un `Math.ceil` a mano, y el texto exacto del diálogo de
       impresión (`VOICE.labels.summary`). -->
  <section
    class="label-print-list"
    aria-label="Tu lista de impresión"
  >
    <h2 class="label-print-list__title">
      {{ VOICE.codigosQr.listTitle }}
    </h2>

    <p
      v-if="rows.length === 0"
      class="label-print-list__empty"
    >
      {{ VOICE.codigosQr.listEmpty }}
    </p>

    <ul
      v-else
      class="label-print-list__rows"
    >
      <li
        v-for="row in rows"
        :key="row.id"
        class="label-print-list__row"
      >
        <span class="label-print-list__name">{{ row.name }}</span>
        <QuantityStepper
          :quantity="row.copies"
          :product-name="row.name"
          :min="1"
          @increment="emit('increment', row.id)"
          @decrement="emit('decrement', row.id)"
          @limit="onLimit(row.id, $event)"
        />
        <AppButton
          variant="ghost"
          size="sm"
          type="button"
          @click="emit('remove', row.id)"
        >
          {{ VOICE.codigosQr.remove }}
        </AppButton>
      </li>
    </ul>

    <p
      v-if="rows.length > 0"
      class="label-print-list__summary"
      aria-live="polite"
    >
      {{ VOICE.labels.summary(totalLabels, totalSheets) }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VOICE } from '@/config/voice'
import { sheetCount } from '@/utils/label-sheet-plan'
import AppButton from '../atoms/AppButton.vue'
import QuantityStepper from '../molecules/QuantityStepper.vue'

export interface PrintListRow {
  id: string
  name: string
  copies: number
}

const props = defineProps<{
  /** Filas en el orden en que se agregaron (Map de inserción, no reordenadas). */
  rows: PrintListRow[]
}>()

const emit = defineEmits<{
  increment: [id: string]
  decrement: [id: string]
  remove: [id: string]
}>()

const totalLabels = computed(() => props.rows.reduce((sum, row) => sum + row.copies, 0))
const totalSheets = computed(() => sheetCount(totalLabels.value))

/** El stepper en `min` emite "limit" en vez de "decrement": aquí se traduce a quitar la fila. */
function onLimit(id: string, which: 'min' | 'max') {
  if (which === 'min') emit('remove', id)
}
</script>

<style scoped>
.label-print-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.label-print-list__title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-text);
}
.label-print-list__empty {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.label-print-list__rows {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}
.label-print-list__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.label-print-list__name {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.label-print-list__summary {
  margin: 0;
  font-weight: 600;
  color: var(--color-text);
}
</style>
