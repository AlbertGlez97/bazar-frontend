<template>
  <!-- Organismo: ficha de un producto (la que se abre al escanear su QR). Presentacional:
       recibe el producto y el rol; emite lo que la persona quiere hacer. El costo y las
       acciones de gestión son solo de socios. Con `showSaleActions` (encima del escáner de
       Venta) ofrece Agregar a la venta y Escanear otro. -->
  <AppModal
    :model-value="modelValue"
    :title="VOICE.productSheet.title"
    size="md"
    hide-footer
    @update:model-value="emit('update:modelValue', $event)"
  >
    <article class="product-sheet">
      <div class="product-sheet__media">
        <img
          v-if="product.image"
          :src="product.image"
          :alt="product.name"
          class="product-sheet__img"
        >
        <div
          v-else
          class="product-sheet__placeholder"
          aria-hidden="true"
        >
          📦
        </div>
      </div>

      <h3 class="product-sheet__name">
        {{ product.name }}
      </h3>
      <p
        v-if="product.brand"
        class="product-sheet__brand"
      >
        {{ product.brand }}
      </p>
      <p
        v-if="product.presentation"
        class="product-sheet__presentation"
      >
        {{ product.presentation }}
      </p>
      <p
        v-if="product.description"
        class="product-sheet__description"
      >
        {{ product.description }}
      </p>

      <div class="product-sheet__figures">
        <p class="product-sheet__price">
          ${{ minorToDisplay(product.unitPriceMinor) }}
        </p>
        <AppBadge :color="available ? 'green' : 'red'">
          <span class="product-sheet__stock">{{ stockLabel }}</span>
        </AppBadge>
      </div>

      <p
        v-if="isSocio"
        class="product-sheet__cost"
      >
        {{ costLabel }}
      </p>

      <div class="product-sheet__actions">
        <template v-if="showSaleActions">
          <AppButton
            variant="primary"
            size="lg"
            :disabled="!available"
            @click="emit('add', product)"
          >
            {{ VOICE.productSheet.add }}
          </AppButton>
          <AppButton
            variant="secondary"
            size="lg"
            @click="emit('scan-another')"
          >
            {{ VOICE.productSheet.scanAnother }}
          </AppButton>
        </template>
        <template v-if="isSocio">
          <AppButton
            variant="secondary"
            @click="emit('edit', product)"
          >
            {{ VOICE.productSheet.edit }}
          </AppButton>
          <AppButton
            v-if="restockable"
            variant="soft-success"
            @click="emit('restock', product)"
          >
            {{ VOICE.productRestock.action }}
          </AppButton>
        </template>
      </div>
    </article>
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VOICE } from '@/config/voice'
import type { Product } from '@/types/product.types'
import { minorToDisplay } from '@/utils/money'
import { canRestock } from '@/utils/product-restock'
import { isProductAvailable } from '@/utils/product-status'
import AppBadge from '../atoms/AppBadge.vue'
import AppButton from '../atoms/AppButton.vue'
import AppModal from './AppModal.vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  product: Product
  /** Socio: ve el costo y puede editar y reponer. Un colaborador, nunca. */
  isSocio?: boolean
  /** Encima del escáner de Venta: Agregar a la venta y Escanear otro. */
  showSaleActions?: boolean
}>(), { isSocio: false, showSaleActions: false })

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  edit: [product: Product]
  restock: [product: Product]
  add: [product: Product]
  'scan-another': []
}>()

const available = computed(() => isProductAvailable(props.product))
const restockable = computed(() => canRestock(props.product))
const stockLabel = computed(() => {
  if (!available.value) return VOICE.productSheet.soldOut
  return props.product.tipo === 'unica' ? VOICE.productSheet.available : VOICE.productSheet.inStock(props.product.stock)
})
const costLabel = computed(() => {
  const cost = props.product.purchaseCostMinor
  return cost == null ? VOICE.productSheet.noCost : VOICE.productSheet.cost(minorToDisplay(cost))
})
</script>

<style scoped>
.product-sheet { display: flex; flex-direction: column; gap: var(--spacing-sm); min-width: 0; }
.product-sheet__media {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 4 / 3;
  max-height: 40vh;
  background: var(--color-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.product-sheet__img { width: 100%; height: 100%; object-fit: contain; }
.product-sheet__placeholder { font-size: 4rem; opacity: 0.4; }
.product-sheet__name { margin: 0; font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text); overflow-wrap: anywhere; }
.product-sheet__brand { margin: 0; font-weight: 600; color: var(--color-text-muted); }
.product-sheet__presentation { margin: 0; color: var(--color-text-muted); overflow-wrap: anywhere; }
.product-sheet__description { margin: 0; color: var(--color-text); overflow-wrap: anywhere; }
.product-sheet__figures { display: flex; align-items: center; justify-content: space-between; gap: var(--spacing-md); flex-wrap: wrap; }
.product-sheet__price { margin: 0; font-family: var(--font-display); font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); }
.product-sheet__cost { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.product-sheet__actions { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }
.product-sheet__actions > * { flex: 1 1 8rem; min-height: 2.75rem; }
</style>
