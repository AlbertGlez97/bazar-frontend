<template>
  <!-- Molécula: "¿Cómo pagan?" — Efectivo, Transferencia o Tarjeta en un control
       segmentado de botones grandes con texto. Efectivo es el que viene
       elegido (lo decide quien la usa). Tono neutro: no compite con "Cobrar". -->
  <div class="payment-method-picker">
    <span class="payment-method-picker__label">{{ VOICE.cobro.methodLabel }}</span>
    <SegmentedControl
      :model-value="modelValue"
      :options="options"
      :label="VOICE.cobro.methodGroup"
      size="lg"
      :disabled="disabled"
      @update:model-value="onSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { VOICE } from '@/config/voice'
import type { PaymentMethod } from '@/types/payment.types'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/utils/payment-method'
import SegmentedControl from './SegmentedControl.vue'

defineProps<{
  modelValue: PaymentMethod
  /** Mientras se cobra no se cambia el método. */
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [method: PaymentMethod] }>()

const options = PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }))

function onSelect(value: string) {
  emit('update:modelValue', value as PaymentMethod)
}
</script>

<style scoped>
.payment-method-picker { display: flex; flex-direction: column; gap: var(--spacing-sm); }
.payment-method-picker__label { font-size: var(--font-size-md); font-weight: 700; color: var(--color-text); }
</style>
