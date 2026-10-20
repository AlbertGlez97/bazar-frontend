<template>
  <!-- Organismo: los campos de un gasto (tipo, categoría, importe, fecha,
       pagador, origen del dinero y descripción). Los usan el formulario de
       alta y la corrección con reemplazo, así que viven en un solo lugar.
       Presentacional: no lee stores; la vista valida y guarda. Una compra de
       inventario fija la categoría "Inventario"; un gasto operativo elige
       una de las demás. -->
  <div class="expense-fields">
    <AppSelect
      :id="`${idPrefix}-nature`"
      :model-value="modelValue.nature"
      label="Tipo"
      :disabled="disabled"
      required
      @update:model-value="onNature"
    >
      <option value="OPERATING_EXPENSE">
        {{ NATURE_LABELS.OPERATING_EXPENSE }}
      </option>
      <option value="INVENTORY_PURCHASE">
        {{ NATURE_LABELS.INVENTORY_PURCHASE }}
      </option>
    </AppSelect>

    <AppSelect
      v-if="isInventory"
      :id="`${idPrefix}-category`"
      model-value="inventory"
      label="Categoría"
      disabled
    >
      <option value="inventory">
        {{ CATEGORY_LABELS.inventory }}
      </option>
    </AppSelect>
    <AppSelect
      v-else
      :id="`${idPrefix}-category`"
      :model-value="modelValue.category"
      label="Categoría"
      placeholder="Selecciona una categoría"
      :disabled="disabled"
      required
      @update:model-value="patch({ category: $event as ExpenseFormState['category'] })"
    >
      <option
        v-for="category in OPERATING_CATEGORIES"
        :key="category.code"
        :value="category.code"
      >
        {{ category.label }}
      </option>
    </AppSelect>

    <AmountInput
      :id="`${idPrefix}-amount`"
      :model-value="modelValue.amount"
      label="Importe"
      :disabled="disabled"
      @update:model-value="patch({ amount: $event })"
    />

    <AppInput
      :id="`${idPrefix}-date`"
      :model-value="modelValue.date"
      label="Fecha"
      type="date"
      :disabled="disabled"
      required
      @update:model-value="patch({ date: $event })"
    />

    <AppSelect
      :id="`${idPrefix}-payer`"
      :model-value="modelValue.paidByMemberId"
      label="Pagado por"
      placeholder="Selecciona quién pagó"
      :disabled="disabled || !payers.length"
      required
      :aria-describedby="`${idPrefix}-payer-hint`"
      @update:model-value="patch({ paidByMemberId: $event as string })"
    >
      <option
        v-for="member in payers"
        :key="member.id"
        :value="member.id"
      >
        {{ member.name }}
      </option>
    </AppSelect>
    <p
      :id="`${idPrefix}-payer-hint`"
      class="expense-fields__hint expense-fields__wide"
      data-test="paid-by-hint"
    >
      La app no le devuelve a nadie el dinero que ponga de su bolsa. El gasto cuenta igual en el resultado.
    </p>

    <AppSelect
      :id="`${idPrefix}-funds`"
      :model-value="modelValue.fundsSource"
      label="Origen del dinero"
      placeholder="Selecciona el origen"
      :disabled="disabled"
      required
      @update:model-value="patch({ fundsSource: $event as ExpenseFormState['fundsSource'] })"
    >
      <option value="BUSINESS">
        {{ FUNDS_SOURCE_LABELS.BUSINESS }}
      </option>
      <option value="PERSONAL">
        {{ FUNDS_SOURCE_LABELS.PERSONAL }}
      </option>
    </AppSelect>

    <AppTextarea
      :id="`${idPrefix}-description`"
      class="expense-fields__wide"
      :model-value="modelValue.description"
      label="Descripción"
      :maxlength="EXPENSE_DESCRIPTION_MAX"
      :disabled="disabled"
      required
      @update:model-value="patch({ description: $event })"
    />
    <p class="expense-fields__hint expense-fields__wide">
      Si pagas con dinero personal, el gasto no se convierte en una aportación
      automáticamente.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppInput from '../molecules/AppInput.vue'
import AppSelect from '../molecules/AppSelect.vue'
import AppTextarea from '../molecules/AppTextarea.vue'
import AmountInput from '../molecules/AmountInput.vue'
import {
  CATEGORY_LABELS,
  FUNDS_SOURCE_LABELS,
  NATURE_LABELS,
  OPERATING_CATEGORIES,
} from '@/utils/expense-catalog'
import {
  EXPENSE_DESCRIPTION_MAX,
  withNature,
  type ExpenseFormState,
} from '@/utils/expense-form'
import type { ExpenseNature } from '@/types/expense.types'

const props = withDefaults(
  defineProps<{
    modelValue: ExpenseFormState
    /** Miembros activos que pueden figurar como quien pagó. */
    payers: readonly { id: string; name: string }[]
    /** Prefijo de los ids (hay un formulario de alta y otro de corrección). */
    idPrefix: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: ExpenseFormState] }>()

const isInventory = computed(() => props.modelValue.nature === 'INVENTORY_PURCHASE')

function patch(change: Partial<ExpenseFormState>) {
  emit('update:modelValue', { ...props.modelValue, ...change })
}
function onNature(value: string | number) {
  emit('update:modelValue', withNature(props.modelValue, value as ExpenseNature))
}
</script>

<style scoped>
.expense-fields {
  display: grid;
  gap: var(--spacing-md);
}
.expense-fields > * {
  min-width: 0;
}
.expense-fields__hint {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
@media (min-width: 640px) {
  .expense-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .expense-fields__wide {
    grid-column: 1 / -1;
  }
}
</style>
