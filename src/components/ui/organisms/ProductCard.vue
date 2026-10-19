<template>
  <!-- Organismo: tarjeta de producto para el grid del catálogo.
       No usa el organismo AppCard (las moléculas no pueden depender de
       organismos, según la regla del proyecto) — reutiliza en su lugar la
       clase utilitaria `.card` ya definida en assets/main.css. -->
  <div
    class="card product-card"
    :class="[
      `product-card--${size}`,
      { 'product-card--inactive': !product.active, 'product-card--selected': selectable && selected },
    ]"
  >
    <!-- Selección para imprimir el código QR: casilla nativa (teclado y lectores de
         pantalla) con un área táctil de 44 px. Un producto inactivo no se marca. -->
    <div
      v-if="selectable"
      class="product-card__select"
    >
      <AppCheckbox
        :model-value="selected"
        :disabled="!product.active"
        :aria-label="VOICE.labels.checkboxLabel(product.name)"
        @update:model-value="$emit('toggle-select', product)"
      />
      <span
        v-if="!product.active"
        class="product-card__select-hint"
      >
        {{ VOICE.labels.inactiveHint }}
      </span>
    </div>

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
      <!-- Piezas de este producto en la venta, sobre la foto (cuadrícula) -->
      <span
        v-if="quantity > 0 && size !== 'list'"
        class="product-card__qty"
      >×{{ quantity }}</span>
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
      <span
        v-if="quantity > 0 && size === 'list'"
        class="product-card__qty"
      >×{{ quantity }}</span>
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
      <!-- Reponer: solo productos por cantidad y activos (ver canRestock) -->
      <AppButton
        v-if="restockable"
        size="sm"
        variant="soft-success"
        :aria-label="VOICE.productRestock.actionAria(product.name)"
        @click="$emit('restock', product)"
      >
        {{ VOICE.productRestock.action }}
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
      <!-- Otra talla, otro color del mismo producto: abre el alta ya precargada -->
      <AppButton
        size="sm"
        variant="secondary"
        :aria-label="VOICE.productDuplicate.actionAria(product.name)"
        @click="$emit('duplicate', product)"
      >
        {{ VOICE.productDuplicate.action }}
      </AppButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { VOICE } from '@/config/voice'
import { minorToDisplay } from '@/utils/money'
import { canRestock } from '@/utils/product-restock'
import { isProductAvailable } from '@/utils/product-status'
import type { Product } from '@/types/product.types'
import AppBadge from '../atoms/AppBadge.vue'
import AppButton from '../atoms/AppButton.vue'
import AppCheckbox from '../atoms/AppCheckbox.vue'

const props = withDefaults(defineProps<{
  product: Product
  /** Solo los socios pueden editar/(des)activar (el backend lo rechazaría igual, pero no tiene sentido mostrarlo a colaboradores) */
  showActions?: boolean
  /**
   * `large` es la presentación de Modo Venta: imagen y tipografía grandes y
   * disponibilidad simplificada (Disponible / Agotado), pensada para tocarse
   * y leerse de un vistazo en el mostrador.
   * `list` es la Vista de Lista de Gestión: fila compacta estilo "explorador
   * de archivos" (miniatura fija, nombre truncado, precio alineado). Solo
   * cambia la presentación (CSS); el contenido y las acciones son los mismos.
   * `compact` es la tarjeta de Modo Venta en celular (bajo 900 px): dos por fila,
   * foto cuadrada y disponibilidad simplificada.
   */
  size?: 'default' | 'large' | 'list' | 'compact'
  /**
   * Fuerza la disponibilidad simplificada (Disponible/Agotado) aunque el
   * tamaño no sea `large`. La usa SaleCatalogPicker (Modo Venta) en su vista
   * "Lista": misma fila compacta de `size="list"`, pero al mostrador solo le
   * importa si se puede vender, nunca el número de existencias — igual que
   * `large`. Sin esta prop, `size="list"` conserva el contenido de
   * `default` (existencias reales), como en la Vista de Lista de Gestión.
   */
  simplifiedAvailability?: boolean
  /** Modo selección (imprimir códigos QR): muestra la casilla. */
  selectable?: boolean
  selected?: boolean
  /** Piezas de este producto en la venta en curso; con más de 0 se ve la insignia "×N". */
  quantity?: number
}>(), {
  showActions: false,
  size: 'default',
  simplifiedAvailability: false,
  selectable: false,
  selected: false,
  quantity: 0,
})

defineEmits<{
  edit: [product: Product]
  deactivate: [product: Product]
  reactivate: [product: Product]
  restock: [product: Product]
  duplicate: [product: Product]
  'toggle-select': [product: Product]
}>()

const restockable = computed(() => canRestock(props.product))

// tipo="unica" siempre tiene stock 1 (o 0 si ya se vendió); tipo="cantidad"
// muestra el número real de existencias. En tamaño grande (venta) solo importa
// saber si se puede vender: Disponible / Agotado.
const stockLabel = computed(() => {
  if (props.product.tipo === 'unica' || props.size === 'large' || props.size === 'compact' || props.simplifiedAvailability) {
    return isProductAvailable(props.product) ? 'Disponible' : 'Agotado'
  }
  return `${props.product.stock} en existencia`
})

const stockBadgeColor = computed(() => (isProductAvailable(props.product) ? 'green' : 'red'))
</script>

<style scoped>
.product-card { display: flex; flex-direction: column; min-width: 0; padding: 0; overflow: hidden; }
.product-card--inactive { opacity: 0.7; }
.product-card--selected { outline: 3px solid var(--color-primary); outline-offset: -3px; }

/* Área táctil de 44 px (guía de marca) aunque la casilla dibujada sea más chica. */
.product-card__select {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 2.75rem;
  padding: 0 var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
}
.product-card__select :deep(.app-checkbox) { min-height: 2.75rem; min-width: 2.75rem; }
.product-card__select-hint { font-size: var(--font-size-sm); color: var(--color-text-muted); }

.product-card__media {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-height: 0;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}
.product-card__img { width: 100%; max-width: 100%; height: 100%; object-fit: cover; }
.product-card__placeholder { font-size: 2.5rem; opacity: 0.4; }
.product-card__inactive-badge { position: absolute; top: var(--spacing-sm); right: var(--spacing-sm); }

.product-card__body {
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs, 4px);
}
.product-card__name { font-weight: 600; font-size: var(--font-size-sm); color: var(--color-text); margin: 0; overflow-wrap: anywhere; }
.product-card__price { font-size: 1.1rem; font-weight: 700; color: var(--color-primary); margin: 0; }
/* Grid rows share height; the body absorbs spare space above the price. */
.product-card:not(.product-card--list) .product-card__body { flex: 1; }
.product-card:not(.product-card--list) .product-card__price { margin-top: auto; }
.product-card:not(.product-card--list) .product-card__name {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}
.product-card__footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

/* Insignia "×N": piezas de este producto en la venta. Sobre la foto en la
   cuadrícula; dentro de la fila en la lista. Con borde y texto, no solo color. */
.product-card__qty {
  position: absolute;
  top: var(--spacing-xs);
  left: var(--spacing-xs);
  min-width: 2rem;
  padding: 0.15rem 0.5rem;
  font-size: var(--font-size-sm);
  font-weight: 800;
  line-height: 1.3;
  text-align: center;
  color: var(--color-on-primary);
  background: var(--color-success);
  border: 2px solid var(--color-surface);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
}
.product-card--list .product-card__qty { position: static; flex: 0 0 auto; border-width: 1px; box-shadow: none; }

/* Tamaño compacto (Modo Venta en celular): foto cuadrada recortada, textos
   chicos y poco aire, para ver varias a la vez en dos columnas. */
.product-card--compact .product-card__media { aspect-ratio: 1 / 1; }
.product-card--compact .product-card__placeholder { font-size: 2.5rem; }
.product-card--compact .product-card__body { padding: var(--spacing-sm); gap: 0.15rem; }
.product-card--compact .product-card__name { font-size: var(--font-size-sm); line-height: 1.25; }
.product-card--compact .product-card__price { font-family: var(--font-display); font-size: var(--font-size-lg); line-height: 1.1; }
.product-card--compact :deep(.app-badge) { align-self: flex-start; font-size: var(--font-size-xs, 0.75rem); padding: 0.1rem 0.5rem; }

/* Tamaño grande (Modo Venta): más aire, imagen 4:3 y tipografía de marca en
   nombre y precio para leerlos de un vistazo. */
.product-card--large .product-card__media { aspect-ratio: 4 / 3; }
.product-card--large .product-card__placeholder { font-size: 4rem; }
.product-card--large .product-card__body { padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg); gap: var(--spacing-sm); }
.product-card--large .product-card__name { font-size: var(--font-size-lg); line-height: 1.25; }
.product-card--large .product-card__price { font-family: var(--font-display); font-size: var(--font-size-xl); line-height: 1.1; }
.product-card--large :deep(.app-badge) { align-self: flex-start; font-size: var(--font-size-sm); padding: 0.25rem 0.75rem; }

/* Tamaño lista (Vista de Lista, Gestión): fila compacta estilo "explorador de
   archivos" — miniatura de tamaño FIJO, nombre y precio en columnas alineadas
   horizontalmente, con el nombre truncado con elipsis si no cabe, y alto de
   fila consistente entre tarjetas. Nunca la imagen ni un nombre largo deciden
   el ancho: solo cambia la presentación (CSS), el contenido es el mismo. */
.product-card--list {
  flex-direction: row;
  align-items: center;
  min-height: 3.5rem;
  gap: var(--spacing-sm);
}
.product-card--list .product-card__select {
  min-height: 0;
  padding: 0 0 0 var(--spacing-sm);
  border-bottom: 0;
}
.product-card--list .product-card__media {
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  aspect-ratio: 1 / 1;
}
.product-card--list .product-card__placeholder { font-size: 1.5rem; }
.product-card--list .product-card__body {
  flex: 1 1 auto;
  flex-direction: row;
  align-items: center;
  min-width: 0;
  padding: var(--spacing-sm) 0;
  gap: var(--spacing-md);
}
.product-card--list .product-card__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.product-card--list .product-card__price { flex: 0 0 auto; white-space: nowrap; }
.product-card--list :deep(.app-badge) { flex: 0 0 auto; }
.product-card--list .product-card__footer {
  flex: 0 0 auto;
  padding: 0 var(--spacing-sm) 0 0;
  border-top: 0;
  flex-wrap: nowrap;
}
</style>
