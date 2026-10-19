<template>
  <!-- Organismo: envuelve ProductForm en AppModal para crear/editar sin
       navegar a otra página. hide-footer porque ProductForm ya trae su
       propio botón de submit/cancelar. Con un `draft` es el alta de "Crear otro igual". -->
  <AppModal
    :model-value="modelValue"
    :title="title"
    size="lg"
    hide-footer
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <!-- La llave hace que cada borrador nuevo (o pasar de editar a copiar) arranque un formulario limpio. -->
    <ProductForm
      :key="draft?.sourceId ?? product?.id ?? 'nuevo'"
      :product="product"
      :draft="draft"
      :loading="loading"
      :brand-suggestions="brandSuggestions"
      :presentation-suggestions="presentationSuggestions"
      @submit="$emit('submit', $event)"
      @submit-and-duplicate="$emit('submit-and-duplicate', $event)"
      @duplicate="$emit('duplicate')"
      @cancel="$emit('update:modelValue', false)"
      @restock="$emit('restock')"
    />

    <!-- Solo en edición: el producto ya existe y tiene id. En creación no hay
         nada que codificar todavía. -->
    <ProductQrCard
      v-if="product"
      class="product-form-modal__qr"
      :product-id="product.id"
      :product-name="product.name"
    />
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VOICE } from '@/config/voice'
import type { Product, ProductDraft, ProductFormSubmitPayload } from '@/types/product.types'
import AppModal from './AppModal.vue'
import ProductForm from '../organisms/ProductForm.vue'
import ProductQrCard from '../molecules/ProductQrCard.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  product?: Product | null
  /** "Crear otro igual": alta precargada con lo copiado de otro producto. */
  draft?: ProductDraft | null
  loading?: boolean
  brandSuggestions?: string[]
  presentationSuggestions?: string[]
}>(), {
  product: null,
  draft: null,
  loading: false,
  brandSuggestions: () => [],
  presentationSuggestions: () => [],
})

defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ProductFormSubmitPayload]
  'submit-and-duplicate': [payload: ProductFormSubmitPayload]
  duplicate: []
  restock: []
}>()

const title = computed(() => {
  if (props.product) return 'Editar producto'
  return props.draft ? VOICE.productDuplicate.title : 'Nuevo producto'
})
</script>
