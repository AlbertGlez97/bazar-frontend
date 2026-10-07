<template>
  <div
    class="overview-figure"
    :class="{
      'overview-figure--prominent': prominent,
      'overview-figure--negative': minor < 0,
    }"
    data-test="figure"
  >
    <p class="overview-figure__label">
      {{ label }}<span
        v-if="partial"
        class="overview-figure__partial"
        data-test="partial-label"
      > (parcial)</span>
    </p>
    <p class="overview-figure__value">
      <template v-if="minor < 0">
        <span aria-hidden="true">{{ formatMinorMoney(minor) }}</span>
        <span class="overview-figure__sr">{{ moneyForScreenReader(minor) }}</span>
      </template>
      <template v-else>
        {{ formatMinorMoney(minor) }}
      </template>
    </p>
    <p
      v-if="note"
      class="overview-figure__note"
    >
      {{ note }}
    </p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { formatMinorMoney } from '@/utils/money'
import { moneyForScreenReader } from '@/utils/finance-overview'

withDefaults(
  defineProps<{
    label: string
    /** Integer MXN cents; may be negative. */
    minor: number
    /** The figure depends on sold-item cost and some costs are unknown. */
    partial?: boolean
    prominent?: boolean
    note?: string
  }>(),
  { partial: false, prominent: false, note: undefined },
)
</script>

<style scoped>
.overview-figure {
  display: grid;
  /* Pack rows at the top: cards stretched by a taller sibling must not push the amount down. */
  align-content: start;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 0;
}
.overview-figure--prominent {
  border-color: var(--color-primary);
  border-width: 2px;
  background: var(--color-primary-soft);
}
.overview-figure__label,
.overview-figure__note {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
.overview-figure__partial {
  color: var(--color-warning);
  font-weight: 600;
}
.overview-figure__value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text);
  overflow-wrap: anywhere;
}
.overview-figure--prominent .overview-figure__value {
  font-size: 2rem;
}
.overview-figure--negative .overview-figure__value {
  color: var(--color-danger);
}
.overview-figure__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
