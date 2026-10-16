<template>
  <!-- Molécula: selector de cantidad, una sola pastilla neutra "− 3 +". No sabe de productos ni de stock real:
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

    <!-- Modo editable: la cantidad se puede teclear (una compra de 100 piezas no se
         captura con 100 toques). El valor lo valida quien lo usa. -->
    <input
      v-if="editable"
      class="quantity-stepper__value quantity-stepper__value--input"
      type="number"
      inputmode="numeric"
      :value="quantity"
      :min="min"
      :max="max"
      :disabled="disabled"
      :aria-label="`Cantidad de ${productName}`"
      @input="onType"
    >
    <!-- <output> es una región viva: al cambiar la cantidad se anuncia el número -->
    <output
      v-else
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
  /** `md`: alto por tipo de puntero (32 px mouse, 44 px dedo); `touch`: siempre ≥ 44 px (catálogo del celular) */
  size?: 'md' | 'touch'
  /** Bloqueo real (por ejemplo mientras se cobra) */
  disabled?: boolean
  /** La cantidad también se puede teclear (emite `update:quantity`). */
  editable?: boolean
}>(), {
  min: 1,
  max: undefined,
  size: 'md',
  disabled: false,
  editable: false,
})

const emit = defineEmits<{
  increment: []
  decrement: []
  /** Se tocó un botón que está en su tope: `min` o `max` */
  limit: [which: 'min' | 'max']
  /** Solo en modo editable: lo que se tecleó (0 si el campo quedó vacío o no es un entero). */
  'update:quantity': [quantity: number]
}>()

function onType(event: Event) {
  const typed = Number((event.target as HTMLInputElement).value)
  emit('update:quantity', Number.isInteger(typed) ? typed : 0)
}

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
/* Una sola pastilla neutra "− 1 +": el contenedor lleva el borde y las esquinas
   redondas, los botones van sin fondo propio. Sin color fuerte: ese es solo de
   "Cobrar" (un botón primario por sección). */
.quantity-stepper {
  display: inline-flex;
  align-items: center;
  gap: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-full);
}

.quantity-stepper__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--control-height-compact);
  min-height: var(--control-height-compact);
  padding: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-lg);
  font-weight: 800;
  line-height: 1;
  color: var(--color-text);
  background: transparent;
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
  touch-action: manipulation;
  transition: background var(--transition);
}
.quantity-stepper__btn:hover:not(:disabled):not(.quantity-stepper__btn--limit) { background: var(--color-surface-alt); }
.quantity-stepper__btn:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

/* Tope alcanzado: se ve apagado (más tenue, sin hover) pero se puede tocar para saber por qué */
.quantity-stepper__btn--limit {
  color: var(--color-text-subtle);
  cursor: not-allowed;
}
.quantity-stepper__btn:disabled { opacity: 0.5; cursor: not-allowed; }

.quantity-stepper__value {
  min-width: 2rem;
  text-align: center;
  font-family: var(--font-display);
  font-size: var(--font-size-md);
  font-weight: 800;
  color: var(--color-text);
}

/* Editable: el campo conserva el aspecto del número y quita las flechitas del navegador */
.quantity-stepper__value--input {
  min-height: var(--control-height-compact);
  padding: 0 var(--spacing-xs);
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  appearance: textfield;
  -moz-appearance: textfield;
}
.quantity-stepper__value--input::-webkit-outer-spin-button,
.quantity-stepper__value--input::-webkit-inner-spin-button { appearance: none; margin: 0; }
.quantity-stepper__value--input:focus-visible { outline: 3px solid var(--color-focus-ring); outline-offset: 2px; }

/* Catálogo del celular: siempre al menos 44 px, con mouse o con dedo */
.quantity-stepper--touch .quantity-stepper__btn {
  min-width: 2.75rem;
  min-height: 2.75rem;
  font-size: var(--font-size-xl);
}
.quantity-stepper--touch .quantity-stepper__value { min-width: 2.25rem; font-size: var(--font-size-lg); }
</style>
