<template>
  <!-- Organismo: envuelve ProductForm en AppModal para crear/editar sin
       navegar a otra página. hide-footer porque ProductForm ya trae su
       propio botón de submit/cancelar. -->
  <AppModal
    :model-value="modelValue"
    :title="product ? 'Editar producto' : 'Nuevo producto'"
    size="lg"
    hide-footer
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <ProductForm
      :product="product"
      :loading="loading"
      @submit="$emit('submit', $event)"
      @cancel="$emit('update:modelValue', false)"
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
import type { Product, ProductFormSubmitPayload } from '@/types/product.types'
import AppModal from './AppModal.vue'
import ProductForm from '../molecules/ProductForm.vue'
import ProductQrCard from '../molecules/ProductQrCard.vue'

defineProps<{
  modelValue: boolean
  product?: Product | null
  loading?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: ProductFormSubmitPayload]
}>()
</script>
