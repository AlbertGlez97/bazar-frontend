<template>
  <!-- Átomo: selector de cantidad "− 3 +". No sabe de productos ni de stock real:
       recibe la cantidad y los topes, y emite lo que la persona quiere hacer.
       En un tope los botones se ven apagados pero NO usan `disabled`: siguen
       enfocables y un toque emite `limit` con el motivo, para que quien lo usa
       pueda explicar "ya no hay más" en vez de dejar un botón muerto y mudo.
       Solo `disabled` (mientras se cobra) bloquea de verdad. -->
  <div
    class="quantity-stepper"
    :class="`quantity-stepper--${size}`"
    role="group"
    :aria-label="`Cantidad de ${productName}`"
  >
    <button
      type="button"
      class="quantity-stepper__btn"
      :class="{ 'quantity-stepper__btn--limit': atMin }"
      data-action="decrement"
      :aria-label="`Quitar una pieza de ${productName}`"
      :aria-disabled="atMin ? 'true' : undefined"
      :disabled="disabled"
      @click="onDecrement"
    >
      <span aria-hidden="true">−</span>
    </button>

    <!-- <output> es una región viva: al cambiar la cantidad se anuncia el número -->
    <output
      class="quantity-stepper__value"
      aria-live="polite"
    >{{ quantity }}</output>

    <button
      type="button"
      class="quantity-stepper__btn"
      :class="{ 'quantity-stepper__btn--limit': atMax }"
      data-action="increment"
      :aria-label="`Agregar una pieza de ${productName}`"
      :aria-disabled="atMax ? 'true' : undefined"
      :disabled="disabled"
      @click="onIncrement"
    >
      <span aria-hidden="true">+</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  quantity: number
  /** Para los nombres accesibles ("Quitar una pieza de Café") */
  productName: string
  min?: number
  /** Tope de existencia; sin valor no hay tope */
  max?: number
  /** `lg` (56 px) en el carrito; `md` (44 px) en el resto */
  size?: 'md' | 'lg'
  /** Bloqueo real (por ejemplo mientras se cobra) */
  disabled?: boolean
}>(), {
  min: 1,
  max: undefined,
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{
  increment: []
  decrement: []
  /** Se tocó un botón que está en su tope: `min` o `max` */
  limit: [which: 'min' | 'max']
}>()

const atMin = computed(() => props.quantity <= props.min)
const atMax = computed(() => props.max !== undefined && props.quantity >= props.max)

function onDecrement() {
  if (atMin.value) emit('limit', 'min')
  else emit('decrement')
}

function onIncrement() {
  if (atMax.value) emit('limit', 'max')
  else emit('increment')
}
</script>

<style scoped>
.quantity-stepper {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.quantity-stepper__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 800;
  line-height: 1;
  color: var(--color-on-primary);
  background: var(--color-primary);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--transition), border-color var(--transition);
}
.quantity-stepper__btn:hover:not(:disabled):not(.quantity-stepper__btn--limit) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}
.quantity-stepper__btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

/* Tope alcanzado: se ve apagado (con borde, no solo color) pero se puede tocar para saber por qué */
.quantity-stepper__btn--limit {
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  border-color: var(--color-border-strong);
  cursor: not-allowed;
}
.quantity-stepper__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.quantity-stepper__value {
  min-width: 2.5rem;
  text-align: center;
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 800;
  color: var(--color-text);
}

/* Carrito: 56 px, lo más cómodo de tocar */
.quantity-stepper--lg .quantity-stepper__btn {
  min-width: 3.5rem;
  min-height: 3.5rem;
  font-size: var(--font-size-2xl);
}
.quantity-stepper--lg .quantity-stepper__value { min-width: 3rem; font-size: var(--font-size-2xl); }
</style>
