<template>
  <!-- Molécula: Disponible / Comprometido / Libre de un período, para avisar antes de crear un acuerdo.
       Presentacional: recibe las cifras ya consultadas; no consulta nada. -->
  <section
    v-if="loading || error || commitment"
    class="commitment-summary"
    aria-label="Disponible, comprometido y libre del período"
  >
    <p
      v-if="loading"
      role="status"
      class="commitment-summary__note"
    >
      Consultando lo comprometido…
    </p>
    <p
      v-else-if="error"
      class="commitment-summary__note"
    >
      {{ error }}
    </p>
    <template v-else-if="commitment">
      <dl class="commitment-summary__list">
        <div class="commitment-summary__item">
          <dt>Disponible</dt>
          <dd>{{ formatMinorMoney(commitment.availableMinor) }}</dd>
        </div>
        <div class="commitment-summary__item">
          <dt>Comprometido</dt>
          <dd>{{ formatMinorMoney(commitment.committedMinor) }}</dd>
        </div>
        <div
          class="commitment-summary__item"
          :class="{ 'commitment-summary__item--empty': commitment.freeMinor === 0 }"
          data-test="free"
        >
          <dt>Libre</dt>
          <dd>{{ formatMinorMoney(commitment.freeMinor) }}</dd>
        </div>
      </dl>
      <p
        v-if="commitment.agreementCount > 0"
        class="commitment-summary__note"
      >
        {{ commitment.agreementCount }} {{ commitment.agreementCount === 1 ? 'acuerdo vigente' : 'acuerdos vigentes' }} en este período.
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { formatMinorMoney } from '@/utils/money'
import type { AgreementCommitment } from '@/types/finance-agreement.types'

withDefaults(defineProps<{
  commitment: AgreementCommitment | null
  loading?: boolean
  error?: string
}>(), { loading: false, error: '' })
</script>

<style scoped>
.commitment-summary { display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm); border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface-alt); }
.commitment-summary__list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--spacing-sm); margin: 0; }
.commitment-summary__item { display: grid; gap: 2px; min-width: 0; }
.commitment-summary__item dt { font-size: var(--font-size-sm); color: var(--color-text-muted); }
.commitment-summary__item dd { margin: 0; font-weight: 700; color: var(--color-text); overflow-wrap: anywhere; }
.commitment-summary__item--empty dd { color: var(--color-danger); }
.commitment-summary__note { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
@media (max-width: 22rem) { .commitment-summary__list { grid-template-columns: 1fr; } }
</style>
