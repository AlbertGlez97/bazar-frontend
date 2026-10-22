<template>
  <!-- Organismo: formulario de producto — modo creación o edición según si
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

    <!-- Datos para distinguir productos parecidos y mostrar su ficha al escanear el QR. -->
    <AppSuggestInput
      v-model="brand"
      :label="VOICE.productDescriptors.brandLabel"
      :hint="VOICE.productDescriptors.brandHint"
      :suggestions="brandSuggestions"
      :maxlength="PRODUCT_TEXT_LIMITS.brand"
    />
    <AppSuggestInput
      ref="presentationField"
      v-model="presentation"
      :label="VOICE.productDescriptors.presentationLabel"
      :hint="VOICE.productDescriptors.presentationHint"
      :suggestions="presentationSuggestions"
      :maxlength="PRODUCT_TEXT_LIMITS.presentation"
    />
    <AppTextarea
      v-model="description"
      :label="VOICE.productDescriptors.descriptionLabel"
      :hint="VOICE.productDescriptors.descriptionHint"
      :rows="2"
      :maxlength="PRODUCT_TEXT_LIMITS.description"
      counter
    />

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
    <!-- La existencia no se escribe aquí: se repone con su propia acción (suma lo
         comprado y deja constancia). Una pieza única o un producto desactivado no se repone. -->
    <div
      v-if="isEditMode && product"
      class="product-form__stock"
    >
      <p class="product-form__readonly-note">
        <template v-if="restockable">
          {{ VOICE.productRestock.formHint(product.stock) }}
        </template>
        <template v-else>
          {{ VOICE.productRestock.currentStock(product.stock) }}.
          {{ product.tipo === 'unica' ? VOICE.productRestock.uniqueNote : VOICE.productRestock.inactiveNote }}
        </template>
      </p>
      <AppButton
        v-if="restockable"
        type="button"
        variant="soft-success"
        size="sm"
        :disabled="loading"
        @click="$emit('restock')"
      >
        Reponer existencia
      </AppButton>
    </div>

    <AppSuggestInput
      v-model="category"
      label="Categoría (opcional)"
      :suggestions="categorySuggestions"
      :maxlength="PRODUCT_TEXT_LIMITS.category"
    />

    <AppInput
      v-model="purchaseCostDisplay"
      :label="purchaseCostLabel"
      type="text"
      inputmode="decimal"
      placeholder="0.00"
      :error="errors.purchaseCostMinor"
    />
    <p
      v-if="showPurchaseCostInvite"
      class="product-form__hint"
    >
      Con esto calculamos tu ganancia en los reportes.
    </p>

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
      :existing-image-url="product?.image ?? draft?.imageUrl ?? null"
      @update:model-value="imageFile = $event"
    />
    <p
      v-if="draft?.imageUrl && !imageFile"
      class="product-form__hint"
    >
      {{ VOICE.productDuplicate.photoHint }}
    </p>

    <div class="product-form__actions">
      <AppButton
        type="button"
        variant="secondary"
        :disabled="loading"
        @click="$emit('cancel')"
      >
        Cancelar
      </AppButton>
      <!-- Editando: abre el alta de otro producto parecido (no guarda lo que se haya cambiado aquí). -->
      <AppButton
        v-if="isEditMode"
        type="button"
        variant="soft-primary"
        :disabled="loading"
        @click="$emit('duplicate')"
      >
        {{ VOICE.productDuplicate.action }}
      </AppButton>
      <!-- Creando: guarda este y abre el siguiente ya precargado. Secundario: lo normal es "Crear producto". -->
      <AppButton
        v-else
        type="button"
        variant="secondary"
        :disabled="loading"
        @click="handleSubmitAndDuplicate"
      >
        {{ VOICE.productDuplicate.saveAndAnother }}
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
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { minorToDisplay, parseMoneyText } from '@/utils/money'
import { canRestock } from '@/utils/product-restock'
import { collapseSpaces } from '@/utils/short-text'
import { PRODUCT_TEXT_LIMITS } from '@/config/catalog'
import { VOICE } from '@/config/voice'
import type {
  Product,
  ProductDraft,
  ProductFormSubmitPayload,
  ProductType,
} from '@/types/product.types'
import AppInput from '../molecules/AppInput.vue'
import AppSelect from '../molecules/AppSelect.vue'
import AppTextarea from '../molecules/AppTextarea.vue'
import AppSuggestInput from '../molecules/AppSuggestInput.vue'
import AppButton from '../atoms/AppButton.vue'
import AppImageUpload from '../molecules/AppImageUpload.vue'
import AppAlert from '../molecules/AppAlert.vue'

const props = withDefaults(defineProps<{
  /** Si se pasa un producto, el formulario opera en modo edición */
  product?: Product | null
  /**
   * "Crear otro igual": es un ALTA que arranca con lo copiado de otro producto (sin
   * presentación ni existencia) y con el cursor en la Presentación.
   */
  draft?: ProductDraft | null
  loading?: boolean
  /** Marcas y presentaciones ya usadas (solo las tienen los socios); sin ellas el campo es de texto libre. */
  brandSuggestions?: string[]
  presentationSuggestions?: string[]
  categorySuggestions?: string[]
}>(), {
  product: null,
  draft: null,
  loading: false,
  brandSuggestions: () => [],
  presentationSuggestions: () => [],
  categorySuggestions: () => [],
})

const emit = defineEmits<{
  submit: [payload: ProductFormSubmitPayload]
  /** Alta y, enseguida, otra igual: el que escucha guarda y abre un borrador nuevo. */
  'submit-and-duplicate': [payload: ProductFormSubmitPayload]
  /** Editando: pide abrir el alta de otro producto parecido. */
  duplicate: []
  cancel: []
  restock: []
}>()

const isEditMode = computed(() => !!props.product)
const restockable = computed(() => !!props.product && canRestock(props.product))

// De dónde salen los valores iniciales: el producto que se edita, o el borrador de
// "Crear otro igual" (mismos nombres de campo). La presentación y la existencia solo
// vienen de un producto: un borrador las deja vacías.
const base = props.product ?? props.draft
const name = ref(base?.name ?? '')
const tipo = ref<ProductType>(base?.tipo ?? 'unica')
const unitPriceDisplay = ref(base ? minorToDisplay(base.unitPriceMinor) : '')
// '' = vacía (un borrador por cantidad: la existencia es de cada combinación).
const initialStock = ref<number | ''>(props.product?.initialStock ?? (props.draft?.tipo === 'cantidad' ? '' : 1))
const category = ref(base?.category ?? '')
const purchaseCostDisplay = ref(base?.purchaseCostMinor != null ? minorToDisplay(base.purchaseCostMinor) : '')
const supplier = ref(base?.supplier ?? '')
const notes = ref(base?.notes ?? '')
const brand = ref(base?.brand ?? '')
const presentation = ref(props.product?.presentation ?? '')
const description = ref(base?.description ?? '')
const imageFile = ref<File | null>(null)

const presentationField = ref<{ focus: () => void } | null>(null)
// "Crear otro igual" abre con el cursor donde falta el dato propio de esta combinación.
onMounted(async () => {
  if (!props.draft) return
  await nextTick()
  presentationField.value?.focus()
})

const errors = ref<{
  name?: string
  unitPriceMinor?: string
  purchaseCostMinor?: string
  initialStock?: string
}>({})
const formError = ref('')

const AMBIGUOUS_AMOUNT_MESSAGE =
  'No entiendo ese monto. Usa coma para miles y punto para centavos, ej. 1,000.50.'
const PURCHASE_COST_REQUIRED_MESSAGE = 'Escribe el costo de compra (puede ser 0 si no te costó).'

/**
 * D3: el costo de compra es obligatorio salvo un caso — editar un producto
 * legado que nunca tuvo costo (`purchaseCostMinor === null` al abrir el
 * form). Ahí se queda opcional para no romper el guardado de catálogo viejo.
 * En creación, y al editar un producto que ya tiene costo, se comporta como
 * `unitPriceMinor` ya se comporta hoy: obligatorio y nunca se deja vacío.
 */
const purchaseCostRequired = computed(() => !isEditMode.value || props.product?.purchaseCostMinor != null)
const purchaseCostLabel = computed(() =>
  purchaseCostRequired.value ? 'Costo de compra (MXN)' : 'Costo de compra (MXN, opcional)'
)
const showPurchaseCostInvite = computed(() => !purchaseCostRequired.value)

// Si tipo cambia a "unica" en modo creación, la existencia se fija a 1
// (el backend la fuerza igual, pero reflejarlo en el form evita confusión).
watch(tipo, (value) => {
  if (value === 'unica') initialStock.value = 1
})

/**
 * Valida el formulario y devuelve los montos ya leídos en centavos (una sola
 * lectura, con la misma regla es-MX que el campo de efectivo), o `null` si hay
 * errores. Un monto ambiguo ("100,50") se avisa en vez de guardarse como 0.
 */
function validate(): { unitPriceMinor: number; purchaseCostMinor: number | null } | null {
  errors.value = {}
  formError.value = ''

  if (!name.value.trim()) errors.value.name = 'Ponle un nombre al producto.'

  const unitPriceMinor = parseMoneyText(unitPriceDisplay.value)
  if (unitPriceMinor === null) {
    errors.value.unitPriceMinor = AMBIGUOUS_AMOUNT_MESSAGE
  } else if (!unitPriceDisplay.value.trim() || unitPriceMinor <= 0) {
    errors.value.unitPriceMinor = 'Escribe un precio mayor a 0.'
  }

  // D3: el costo es obligatorio salvo el caso legado (ver `purchaseCostRequired`).
  // A diferencia del precio, el costo acepta 0 (`parseMoneyText` nunca da
  // negativos, así que no hace falta una comparación `< 0` aparte).
  let purchaseCostMinor: number | null = null
  const purchaseCostText = purchaseCostDisplay.value.trim()
  if (!purchaseCostText) {
    if (purchaseCostRequired.value) {
      errors.value.purchaseCostMinor = isEditMode.value
        ? VOICE.apiErrors.product.purchaseCostLocked
        : PURCHASE_COST_REQUIRED_MESSAGE
    }
  } else {
    purchaseCostMinor = parseMoneyText(purchaseCostDisplay.value)
    if (purchaseCostMinor === null) errors.value.purchaseCostMinor = AMBIGUOUS_AMOUNT_MESSAGE
  }

  if (!isEditMode.value && tipo.value === 'cantidad' && (!initialStock.value || initialStock.value < 0)) {
    errors.value.initialStock = 'Escribe cuántas piezas tienes.'
  }

  if (unitPriceMinor === null || Object.keys(errors.value).length > 0) {
    formError.value = 'Revisa los campos marcados para continuar.'
    return null
  }
  return { unitPriceMinor, purchaseCostMinor }
}

/** Valida y arma lo que se manda; `null` si hay errores (ya quedaron marcados en el formulario). */
function buildPayload(): ProductFormSubmitPayload | null {
  const amounts = validate()
  if (!amounts) return null
  const { unitPriceMinor, purchaseCostMinor } = amounts

  if (isEditMode.value && props.product) {
    // Modo edición: solo se envían los campos que realmente cambiaron, para
    // no sobreescribir accidentalmente algo que el usuario no tocó (ej.
    // limpiar `category` a null solo porque el campo llegó vacío desde el
    // inicio). PATCH /products/:id exige al menos un campo.
    const original = props.product
    const payload: Record<string, unknown> = {}

    if (name.value !== original.name) payload.name = name.value
    if (unitPriceMinor !== original.unitPriceMinor) payload.unitPriceMinor = unitPriceMinor

    const categoryValue = collapseSpaces(category.value) || null
    if (categoryValue !== original.category) payload.category = categoryValue

    if (purchaseCostMinor !== original.purchaseCostMinor) payload.purchaseCostMinor = purchaseCostMinor

    const supplierValue = supplier.value.trim() || null
    if (supplierValue !== original.supplier) payload.supplier = supplierValue

    const notesValue = notes.value.trim() || null
    if (notesValue !== original.notes) payload.notes = notesValue

    // Marca, presentación y descripción: igual que el servidor las guarda (espacios
    // juntos y recortados, vacío = null). Un producto de antes no los trae (ausentes).
    const descriptors = { brand, presentation, description } as const
    for (const key of ['brand', 'presentation', 'description'] as const) {
      const value = collapseSpaces(descriptors[key].value) || null
      if (value !== (original[key] ?? null)) payload[key] = value
    }

    return { ...payload, imageFile: imageFile.value } as ProductFormSubmitPayload
  }

  return {
    name: name.value,
    tipo: tipo.value,
    unitPriceMinor,
    initialStock: tipo.value === 'cantidad' ? Number(initialStock.value) : undefined,
    category: collapseSpaces(category.value) || undefined,
    purchaseCostMinor: purchaseCostMinor ?? undefined,
    supplier: supplier.value.trim() || undefined,
    notes: notes.value.trim() || undefined,
    brand: collapseSpaces(brand.value) || undefined,
    presentation: collapseSpaces(presentation.value) || undefined,
    description: collapseSpaces(description.value) || undefined,
    imageFile: imageFile.value,
    // La foto de otro producto no se comparte: quien guarda la sube como archivo nuevo.
    // Si se eligió una propia, esa manda.
    ...(props.draft?.imageUrl && !imageFile.value ? { copyImageFrom: props.draft.imageUrl } : {}),
  }
}

function handleSubmit() {
  const payload = buildPayload()
  if (payload) emit('submit', payload)
}

function handleSubmitAndDuplicate() {
  const payload = buildPayload()
  if (payload) emit('submit-and-duplicate', payload)
}
</script>

<style scoped>
.product-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.product-form__readonly-note,
.product-form__hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}
.product-form__stock {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xs);
}
.product-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>
