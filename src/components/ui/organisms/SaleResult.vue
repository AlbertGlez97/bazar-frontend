<template>
  <!-- Organismo: pantalla de resultado del cobro. Cada resultado tiene su propio
       título, ícono y color (nunca se confunden: un conflicto NO se parece a un
       éxito) y UN solo botón principal grande. Presentacional: recibe una vista
       plana del resultado y emite lo que la persona decide. -->
  <section
    class="sale-result"
    :class="`sale-result--${result.kind}`"
    :role="isAlert ? 'alert' : 'status'"
  >
    <span
      class="sale-result__icon"
      aria-hidden="true"
    >{{ icon }}</span>

    <h2
      ref="headingEl"
      class="sale-result__title"
      tabindex="-1"
    >
      {{ title }}
    </h2>

    <!-- Cifras grandes (venta cobrada, guardada y sesión vencida) -->
    <div
      v-if="showsAmounts"
      class="sale-result__amounts"
    >
      <p class="sale-result__total">
        <span class="sale-result__label">{{ VOICE.saleResult.totalLabel }}</span>
        <span class="sale-result__number">${{ minorToDisplay(amounts.totalMinor) }}</span>
      </p>
      <p class="sale-result__change">
        <span class="sale-result__label">{{ amounts.changeMinor > 0 ? VOICE.saleResult.changeLabel : VOICE.saleResult.noChange }}</span>
        <span
          v-if="amounts.changeMinor > 0"
          class="sale-result__number sale-result__number--change"
        >${{ minorToDisplay(amounts.changeMinor) }}</span>
      </p>
    </div>

    <p
      v-if="body"
      class="sale-result__body"
    >
      {{ body }}
    </p>
    <p
      v-if="result.kind === 'conflict'"
      class="sale-result__body sale-result__body--action"
    >
      {{ VOICE.saleResult.conflictAction }}
    </p>
    <p
      v-if="result.kind === 'success' && result.summary"
      class="sale-result__summary"
    >
      {{ result.summary }}
    </p>

    <!-- El motivo técnico del servidor es solo un detalle para el socio -->
    <details
      v-if="result.kind === 'conflict' && result.detail"
      class="sale-result__detail"
    >
      <summary>{{ VOICE.saleResult.conflictDetail }}</summary>
      <p>{{ result.detail }}</p>
    </details>

    <div class="sale-result__actions">
      <AppButton
        variant="primary"
        size="xl"
        block
        type="button"
        class="sale-result__primary"
        @click="onPrimary"
      >
        {{ primaryLabel }}
      </AppButton>
      <AppButton
        v-if="secondary"
        variant="secondary"
        size="lg"
        block
        type="button"
        class="sale-result__secondary"
        @click="onSecondary"
      >
        {{ secondary.label }}
      </AppButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { minorToDisplay } from '@/utils/money'
import { VOICE } from '@/config/voice'
import type { SaleResultView } from '@/types/sale-result.types'
import AppButton from '../atoms/AppButton.vue'

const props = defineProps<{
  result: SaleResultView
}>()

const emit = defineEmits<{
  /** Empezar una venta nueva (vacía el carrito) */
  'new-sale': []
  /** Volver a la venta conservando el carrito */
  back: []
  /** Volver a intentar guardar/cobrar */
  retry: []
  /** Ir a iniciar sesión otra vez */
  login: []
}>()

const headingEl = ref<HTMLElement | null>(null)

// Al aparecer, el foco va al título: un lector de pantalla lo anuncia y un
// teclado empieza desde ahí (la pantalla anterior desaparece de golpe).
onMounted(() => headingEl.value?.focus())

const isAlert = computed(() => props.result.kind !== 'success' && props.result.kind !== 'saved-offline')

const ICONS: Record<SaleResultView['kind'], string> = {
  success: '✓',
  'saved-offline': '✓',
  conflict: '!',
  rejected: '✕',
  'auth-needed': '🔒',
  'failed-to-save': '💾',
  blocked: '!',
}
// La venta guardada sin señal lleva una nube junto a la palomita: se siente
// como éxito, pero es distinguible de "Venta registrada".
const icon = computed(() => (props.result.kind === 'saved-offline' ? '✓ ☁' : ICONS[props.result.kind]))

const TITLES: Record<SaleResultView['kind'], string> = {
  success: VOICE.saleResult.successTitle,
  'saved-offline': VOICE.saleResult.savedTitle,
  conflict: VOICE.saleResult.conflictTitle,
  rejected: VOICE.saleResult.rejectedTitle,
  'auth-needed': VOICE.saleResult.authNeededTitle,
  'failed-to-save': VOICE.saleResult.failedToSaveTitle,
  blocked: VOICE.saleResult.blockedTitle,
}
const title = computed(() => TITLES[props.result.kind])

const body = computed(() => {
  const result = props.result
  if (result.kind === 'saved-offline') return VOICE.saleResult.savedBody
  if (result.kind === 'success') return ''
  return result.message
})

const showsAmounts = computed(() =>
  props.result.kind === 'success' || props.result.kind === 'saved-offline' || props.result.kind === 'auth-needed',
)
const amounts = computed(() => {
  const result = props.result
  if (result.kind === 'success' || result.kind === 'saved-offline' || result.kind === 'auth-needed') {
    return { totalMinor: result.totalMinor, changeMinor: result.changeMinor }
  }
  return { totalMinor: 0, changeMinor: 0 }
})

const primaryLabel = computed(() => {
  switch (props.result.kind) {
    case 'success':
    case 'saved-offline': return VOICE.saleResult.newSale
    case 'conflict': return VOICE.saleResult.newSaleAfterConflict
    case 'auth-needed': return VOICE.saleResult.login
    case 'failed-to-save': return VOICE.saleResult.retry
    default: return VOICE.saleResult.back
  }
})

function onPrimary() {
  switch (props.result.kind) {
    case 'success':
    case 'saved-offline':
    case 'conflict':
      emit('new-sale')
      break
    case 'auth-needed':
      emit('login')
      break
    case 'failed-to-save':
      emit('retry')
      break
    default:
      emit('back')
  }
}

function onSecondary() {
  if (secondary.value?.event === 'back') emit('back')
  else if (secondary.value) emit('new-sale')
}

/** Salida secundaria, solo donde hay una alternativa razonable y segura. */
const secondary = computed<{ label: string; event: 'new-sale' | 'back' } | null>(() => {
  if (props.result.kind === 'auth-needed') return { label: VOICE.saleResult.newSale, event: 'new-sale' }
  if (props.result.kind === 'failed-to-save') return { label: VOICE.saleResult.back, event: 'back' }
  return null
})
</script>

<style scoped>
.sale-result {
  --result-color: var(--color-success);
  --result-soft: var(--color-success-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  max-width: 34rem;
  margin: 0 auto;
  padding: var(--spacing-xl) var(--spacing-lg);
  text-align: center;
  background: var(--color-surface);
  border: 3px solid var(--result-color);
  border-radius: var(--radius-xl);
}

/* Cada resultado, su color. Éxito y guardada = nopal; el resto avisa distinto. */
.sale-result--conflict,
.sale-result--blocked { --result-color: var(--color-warning); --result-soft: var(--color-warning-soft); }
.sale-result--rejected,
.sale-result--failed-to-save { --result-color: var(--color-danger); --result-soft: var(--color-danger-soft); }
.sale-result--auth-needed { --result-color: var(--color-info); --result-soft: var(--color-info-soft); }

.sale-result__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 5rem;
  height: 5rem;
  padding: 0 var(--spacing-md);
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 800;
  line-height: 1;
  color: var(--result-color);
  background: var(--result-soft);
  border: 3px solid var(--result-color);
  border-radius: var(--radius-full);
}

.sale-result__title {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: 800;
  line-height: 1.15;
  color: var(--result-color);
  text-wrap: balance;
}
.sale-result__title:focus { outline: none; }

.sale-result__amounts { display: grid; gap: var(--spacing-md); width: 100%; }
.sale-result__total,
.sale-result__change {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--result-soft);
  border-radius: var(--radius-lg);
}
.sale-result__label { font-size: var(--font-size-md); font-weight: 700; color: var(--color-text-muted); }
.sale-result__number { font-family: var(--font-display); font-size: 3rem; font-weight: 800; line-height: 1.05; color: var(--color-text); }
.sale-result__number--change { color: var(--result-color); font-size: 3.5rem; }

.sale-result__body { margin: 0; font-size: var(--font-size-lg); line-height: 1.5; color: var(--color-text); }
.sale-result__body--action { font-weight: 700; }
.sale-result__summary { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }

.sale-result__detail { width: 100%; font-size: var(--font-size-sm); color: var(--color-text-muted); text-align: left; }
.sale-result__detail summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; font-weight: 600; }
.sale-result__detail p { margin: 0; padding: var(--spacing-sm) var(--spacing-md); background: var(--color-surface-alt); border-radius: var(--radius-md); overflow-wrap: anywhere; }

.sale-result__actions { display: flex; flex-direction: column; gap: var(--spacing-sm); width: 100%; margin-top: var(--spacing-sm); }
/* El botón principal: 56 px. Doble clase para ganarle a los tamaños de AppButton. */
.sale-result .sale-result__primary { min-height: 3.5rem; font-size: 1.25rem; font-weight: 800; }
.sale-result .sale-result__secondary { min-height: 3.5rem; font-size: var(--font-size-md); font-weight: 700; }
</style>
