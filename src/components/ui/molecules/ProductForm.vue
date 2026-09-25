<template>
  <!-- Molécula: formulario de producto — modo creación o edición según si
       se recibe la prop `product`. Agrupa además la subida de imagen (la
       decisión de UX fue combinar "editar" y "subir imagen" en un mismo
       formulario en vez de un botón separado, ya que es el flujo más común
       y natural: casi siempre que se edita un producto también se le
       actualiza la foto). -->
  <form
    class="product-form"
    @submit.prevent="handleSubmit"
  >
    <AppAlert
      v-if="formError"
      type="error"
      :show="true"
    >
      {{ formError }}
    </AppAlert>

    <AppInput
      v-model="name"
      label="Nombre"
      placeholder="Ej. Consola PS5 usada"
      :error="errors.name"
    />

    <AppSelect
      v-if="!isEditMode"
      v-model="tipo"
      label="Tipo"
    >
      <option value="unica">
        Pieza única
      </option>
      <option value="cantidad">
        Por cantidad
      </option>
    </AppSelect>
    <p
      v-else
      class="product-form__readonly-note"
    >
      Tipo: {{ tipo === 'unica' ? 'Pieza única' : 'Por cantidad' }} (no editable)
    </p>

    <AppInput
      v-model="unitPriceDisplay"
      label="Precio de venta (MXN)"
      type="text"
      inputmode="decimal"
      placeholder="0.00"
      :error="errors.unitPriceMinor"
    />

    <AppInput
      v-if="!isEditMode && tipo === 'cantidad'"
      v-model.number="initialStock"
      label="Existencia inicial"
      type="number"
      min="0"
      :error="errors.initialStock"
    />
    <AppInput
      v-if="!isEditMode && tipo === 'unica'"
      model-value="1"
      label="Existencia inicial"
      disabled
    />
    <p
      v-if="isEditMode"
      class="product-form__readonly-note"
    >
      Existencia actual: {{ product?.stock }} (se administra desde ventas/inventario, no aquí)
    </p>

    <AppInput
      v-model="category"
      label="Categoría (opcional)"
    />

    <AppInput
      v-model="purchaseCostDisplay"
      label="Costo de compra (MXN, opcional)"
      type="text"
      inputmode="decimal"
      placeholder="0.00"
    />

    <AppInput
      v-model="supplier"
      label="Proveedor (opcional)"
    />

    <AppTextarea
      v-model="notes"
      label="Notas (opcional)"
      :rows="3"
    />

    <AppImageUpload
      label="Imagen del producto (opcional)"
      :existing-image-url="product?.image ?? null"
      @update:model-value="imageFile = $event"
    />

    <div class="product-form__actions">
      <AppButton
        type="button"
        variant="secondary"
        :disabled="loading"
        @click="$emit('cancel')"
      >
        Cancelar
      </AppButton>
      <AppButton
        type="submit"
        variant="primary"
        :loading="loading"
      >
        {{ isEditMode ? 'Guardar cambios' : 'Crear producto' }}
      </AppButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { displayToMinor, minorToDisplay } from '@/utils/money'
import type {
  Product,
  ProductFormSubmitPayload,
  ProductType,
} from '@/types/product.types'
import AppInput from '../atoms/AppInput.vue'
import AppSelect from '../atoms/AppSelect.vue'
import AppTextarea from '../atoms/AppTextarea.vue'
import AppButton from '../atoms/AppButton.vue'
import AppImageUpload from '../atoms/AppImageUpload.vue'
import AppAlert from './AppAlert.vue'

const props = defineProps<{
  /** Si se pasa un producto, el formulario opera en modo edición */
  product?: Product | null
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [payload: ProductFormSubmitPayload]
  cancel: []
}>()

const isEditMode = computed(() => !!props.product)

const name = ref(props.product?.name ?? '')
const tipo = ref<ProductType>(props.product?.tipo ?? 'unica')
const unitPriceDisplay = ref(props.product ? minorToDisplay(props.product.unitPriceMinor) : '')
const initialStock = ref(props.product?.initialStock ?? 1)
const category = ref(props.product?.category ?? '')
const purchaseCostDisplay = ref(
  props.product?.purchaseCostMinor != null ? minorToDisplay(props.product.purchaseCostMinor) : ''
)
const supplier = ref(props.product?.supplier ?? '')
const notes = ref(props.product?.notes ?? '')
const imageFile = ref<File | null>(null)

const errors = ref<{ name?: string; unitPriceMinor?: string; initialStock?: string }>({})
const formError = ref('')

// Si tipo cambia a "unica" en modo creación, la existencia se fija a 1
// (el backend la fuerza igual, pero reflejarlo en el form evita confusión).
watch(tipo, (value) => {
  if (value === 'unica') initialStock.value = 1
})

function validate(): boolean {
  errors.value = {}
  formError.value = ''

  if (!name.value.trim()) errors.value.name = 'Ponle un nombre al producto.'

  const unitPriceMinor = displayToMinor(unitPriceDisplay.value)
  if (!unitPriceDisplay.value.trim() || unitPriceMinor <= 0) {
    errors.value.unitPriceMinor = 'Escribe un precio mayor a 0.'
  }

  if (!isEditMode.value && tipo.value === 'cantidad' && (!initialStock.value || initialStock.value < 0)) {
    errors.value.initialStock = 'Escribe cuántas piezas tienes.'
  }

  const hasErrors = Object.keys(errors.value).length > 0
  if (hasErrors) formError.value = 'Revisa los campos marcados para continuar.'
  return !hasErrors
}

function handleSubmit() {
  if (!validate()) return

  const unitPriceMinor = displayToMinor(unitPriceDisplay.value)
  const purchaseCostMinor = purchaseCostDisplay.value.trim()
    ? displayToMinor(purchaseCostDisplay.value)
    : null

  if (isEditMode.value && props.product) {
    // Modo edición: solo se envían los campos que realmente cambiaron, para
    // no sobreescribir accidentalmente algo que el usuario no tocó (ej.
    // limpiar `category` a null solo porque el campo llegó vacío desde el
    // inicio). PATCH /products/:id exige al menos un campo.
    const original = props.product
    const payload: Record<string, unknown> = {}

    if (name.value !== original.name) payload.name = name.value
    if (unitPriceMinor !== original.unitPriceMinor) payload.unitPriceMinor = unitPriceMinor

    const categoryValue = category.value.trim() || null
    if (categoryValue !== original.category) payload.category = categoryValue

    if (purchaseCostMinor !== original.purchaseCostMinor) payload.purchaseCostMinor = purchaseCostMinor

    const supplierValue = supplier.value.trim() || null
    if (supplierValue !== original.supplier) payload.supplier = supplierValue

    const notesValue = notes.value.trim() || null
    if (notesValue !== original.notes) payload.notes = notesValue

    emit('submit', { ...payload, imageFile: imageFile.value } as ProductFormSubmitPayload)
    return
  }

  emit('submit', {
    name: name.value,
    tipo: tipo.value,
    unitPriceMinor,
    initialStock: tipo.value === 'cantidad' ? initialStock.value : undefined,
    category: category.value.trim() || undefined,
    purchaseCostMinor: purchaseCostMinor ?? undefined,
    supplier: supplier.value.trim() || undefined,
    notes: notes.value.trim() || undefined,
    imageFile: imageFile.value,
  })
}
</script>

<style scoped>
.product-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.product-form__readonly-note {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}
.product-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
