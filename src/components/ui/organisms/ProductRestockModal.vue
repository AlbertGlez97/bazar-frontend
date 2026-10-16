<template>
  <!-- Organismo: envuelve ProductRestockForm en AppModal para reponer sin salir
       del catálogo. hide-footer porque el formulario trae sus propios botones.
       El formulario se monta de nuevo en cada apertura, así que nunca recuerda
       la captura anterior. -->
  <AppModal
    :model-value="modelValue"
    :title="VOICE.productRestock.title"
    size="md"
    hide-footer
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <ProductRestockForm
      v-if="product"
      :product="product"
      :loading="loading"
      @submit="$emit('submit', $event)"
      @cancel="$emit('update:modelValue', false)"
    />
  </AppModal>
</template>

<script setup lang="ts">
import { VOICE } from '@/config/voice'
import type { Product, RestockProductPayload } from '@/types/product.types'
import AppModal from './AppModal.vue'
import ProductRestockForm from './ProductRestockForm.vue'

defineProps<{
  modelValue: boolean
  product: Product | null
  loading?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
  submit: [payload: RestockProductPayload]
}>()
</script>
