<template>
  <!-- Organismo: formulario de reposición — suma piezas compradas a un producto
       por cantidad. Solo presenta y valida: las reglas viven en utils/product-
       restock y quien lo usa (la vista) decide qué hacer con lo que se envía. -->
  <form
    class="product-restock-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <p class="product-restock-form__intro">
      {{ copy.intro(product.name) }}
    </p>
    <p
      v-if="subtitle"
      class="product-restock-form__subtitle"
    >
      {{ subtitle }}
    </p>

    <AppAlert
      v-if="formError"
      type="error"
      :show="true"
    >
      {{ formError }}
    </AppAlert>

    <div class="product-restock-form__quantity">
      <span
       
        class="product-restock-form__label"
      >{{ copy.quantityLabel }}</span>
      <QuantityStepper
        editable
        :quantity="quantity"
        :product-name="product.name"
        :min="1"
        :max="maxQuantity"
        :disabled="loading"
        @increment="quantity += 1"
        @decrement="quantity -= 1"
        @update:quantity="quantity = $event"
      />
      <p
        v-if="errors.quantity"
        class="product-restock-form__error"
        role="alert"
      >
        {{ errors.quantity }}
      </p>
      <p class="product-restock-form__stock">
        {{ copy.currentStock(product.stock) }}
        <strong v-if="quantityIsValid">· {{ copy.stockAfter(stockAfter) }}</strong>
      </p>
    </div>

    <AppInput
      v-model="costText"
      :label="copy.costLabel"
      type="text"
      inputmode="decimal"
      placeholder="0.00"
      :disabled="loading"
      :error="errors.cost"
    />
    <p class="product-restock-form__hint">
      {{ copy.costHint }}
    </p>

    <AppTextarea
      v-model="note"
      :label="copy.noteLabel"
      :rows="3"
      :disabled="loading"
      :error="errors.note"
    />

    <div class="product-restock-form__actions">
      <AppButton
        type="button"
        variant="secondary"
        :disabled="loading"
        @click="$emit('cancel')"
      >
        {{ copy.cancel }}
      </AppButton>
      <AppButton
        type="submit"
        variant="primary"
        :loading="loading"
      >
        {{ copy.submit }}
      </AppButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { VOICE } from '@/config/voice'
import type { Product, RestockProductPayload } from '@/types/product.types'
import { productSubtitle } from '@/utils/product-label'
import { buildRestockPayload, maxRestockQuantity, stockAfterRestock } from '@/utils/product-restock'
import type { RestockErrors } from '@/utils/product-restock'
import AppButton from '../atoms/AppButton.vue'
import AppAlert from '../molecules/AppAlert.vue'
import AppInput from '../molecules/AppInput.vue'
import AppTextarea from '../molecules/AppTextarea.vue'
import QuantityStepper from '../molecules/QuantityStepper.vue'

const props = defineProps<{
  product: Product
  /** Mientras se envía: todo se bloquea y un segundo envío no hace nada (sin doble clic). */
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: RestockProductPayload]
  cancel: []
}>()

const copy = VOICE.productRestock
const subtitle = computed(() => productSubtitle(props.product))

const quantity = ref(1)
const costText = ref('')
const note = ref('')
const errors = ref<RestockErrors>({})
const formError = ref('')

const maxQuantity = computed(() => maxRestockQuantity(props.product))
const quantityIsValid = computed(() => Number.isInteger(quantity.value) && quantity.value >= 1 && quantity.value <= maxQuantity.value)
const stockAfter = computed(() => stockAfterRestock(props.product, quantity.value))

function handleSubmit() {
  if (props.loading) return
  const result = buildRestockPayload(
    { quantity: quantity.value, costText: costText.value, note: note.value },
    props.product,
  )
  if (!result.ok) {
    errors.value = result.errors
    formError.value = copy.reviewFields
    return
  }
  errors.value = {}
  formError.value = ''
  emit('submit', result.payload)
}
</script>

<style scoped>
.product-restock-form__subtitle { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.product-restock-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.product-restock-form__intro,
.product-restock-form__hint,
.product-restock-form__stock {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}
.product-restock-form__stock strong { color: var(--color-text); }
.product-restock-form__quantity {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xs);
}
.product-restock-form__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}
.product-restock-form__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}
.product-restock-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
