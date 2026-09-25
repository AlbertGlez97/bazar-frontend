<template>
  <!-- Molécula: tarjeta de producto para el grid del catálogo.
       No usa el organismo AppCard (las moléculas no pueden depender de
       organismos, según la regla del proyecto) — reutiliza en su lugar la
       clase utilitaria `.card` ya definida en assets/main.css. -->
  <div
    class="card product-card"
    :class="[
      `product-card--${size}`,
      { 'product-card--inactive': !product.active },
    ]"
  >
    <div class="product-card__media">
      <img
        v-if="product.image"
        :src="product.image"
        :alt="product.name"
        class="product-card__img"
      >
      <div
        v-else
        class="product-card__placeholder"
        aria-hidden="true"
      >
        📦
      </div>
      <AppBadge
        v-if="!product.active"
        color="gray"
        filled
        class="product-card__inactive-badge"
      >
        Inactivo
      </AppBadge>
    </div>

    <div class="product-card__body">
      <p class="product-card__name">
        {{ product.name }}
      </p>
      <p class="product-card__price">
        ${{ minorToDisplay(product.unitPriceMinor) }}
      </p>
      <AppBadge :color="stockBadgeColor">
        {{ stockLabel }}
      </AppBadge>
    </div>

    <div
      v-if="showActions"
      class="product-card__footer"
    >
      <AppButton
        size="sm"
        variant="secondary"
        @click="$emit('edit', product)"
      >
        Editar
      </AppButton>
      <AppButton
        v-if="product.active"
        size="sm"
        variant="soft-danger"
        @click="$emit('deactivate', product)"
      >
        Desactivar
      </AppButton>
      <AppButton
        v-else
        size="sm"
        variant="soft-success"
        @click="$emit('reactivate', product)"
      >
        Reactivar
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { minorToDisplay } from '@/utils/money'
import type { Product } from '@/types/product.types'
import AppBadge from '../atoms/AppBadge.vue'
import AppButton from '../atoms/AppButton.vue'

const props = withDefaults(defineProps<{
  product: Product
  /** Solo los socios pueden editar/(des)activar (el backend lo rechazaría igual, pero no tiene sentido mostrarlo a colaboradores) */
  showActions?: boolean
  /**
   * `large` es la presentación de Modo Venta: imagen y tipografía grandes y
   * disponibilidad simplificada (Disponible / Agotado), pensada para tocarse
   * y leerse de un vistazo en el mostrador.
   */
  size?: 'default' | 'large'
}>(), {
  showActions: false,
  size: 'default',
})

defineEmits<{
  edit: [product: Product]
  deactivate: [product: Product]
  reactivate: [product: Product]
}>()

// tipo="unica" siempre tiene stock 1 (o 0 si ya se vendió); tipo="cantidad"
// muestra el número real de existencias. En tamaño grande (venta) solo importa
// saber si se puede vender: Disponible / Agotado.
const stockLabel = computed(() => {
  if (props.product.tipo === 'unica' || props.size === 'large') {
    return props.product.stock > 0 ? 'Disponible' : 'Agotado'
  }
  return `${props.product.stock} en existencia`
})

const stockBadgeColor = computed(() => (props.product.stock > 0 ? 'green' : 'red'))
</script>

<style scoped>
.product-card { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.product-card--inactive { opacity: 0.7; }

.product-card__media {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}
.product-card__img { width: 100%; height: 100%; object-fit: cover; }
.product-card__placeholder { font-size: 2.5rem; opacity: 0.4; }
.product-card__inactive-badge { position: absolute; top: var(--spacing-sm); right: var(--spacing-sm); }

.product-card__body {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
}
.product-card__name { font-weight: 600; font-size: var(--font-size-sm); color: var(--color-text); margin: 0; }
.product-card__price { font-size: 1.1rem; font-weight: 700; color: var(--color-primary); margin: 0; }
.product-card__footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

/* Tamaño grande (Modo Venta): más aire, imagen 4:3 y tipografía de marca en
   nombre y precio para leerlos de un vistazo. */
.product-card--large .product-card__media { aspect-ratio: 4 / 3; }
.product-card--large .product-card__placeholder { font-size: 4rem; }
.product-card--large .product-card__body { padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg); gap: var(--spacing-sm); }
.product-card--large .product-card__name { font-size: var(--font-size-lg); line-height: 1.25; }
.product-card--large .product-card__price { font-family: var(--font-display); font-size: var(--font-size-xl); line-height: 1.1; }
.product-card--large :deep(.app-badge) { align-self: flex-start; font-size: var(--font-size-sm); padding: 0.25rem 0.75rem; }
</style>
