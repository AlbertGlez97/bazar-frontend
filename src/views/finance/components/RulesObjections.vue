<template>
  <ul
    class="rules-objections"
    :aria-label="label"
    data-test="rules-objections"
  >
    <li
      v-for="objection in items"
      :key="objection.memberId"
      class="rules-objections__item"
    >
      <strong>{{ objection.name }}</strong>
      <span class="rules-objections__meta">
        ({{ objection.correo }}) · {{ formatRuleDateTime(objection.createdAt) }}
      </span>
      <!-- El motivo lo escribe una persona: se muestra como texto, nunca como HTML. -->
      <q class="rules-objections__reason">{{ objection.reason }}</q>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { formatRuleDateTime } from '@/utils/finance-rules'
import type { RuleObjection } from '@/types/finance-rules.types'

withDefaults(defineProps<{ items: readonly RuleObjection[]; label?: string }>(), {
  label: 'Motivos de quienes no están de acuerdo',
})
</script>

<style scoped>
.rules-objections { display: grid; gap: var(--spacing-xs); margin: 0; padding: 0; list-style: none; }
.rules-objections__item {
  display: grid; gap: 2px; padding: var(--spacing-sm);
  border-left: 4px solid var(--color-warning); background: var(--color-surface); border-radius: var(--radius-sm);
}
.rules-objections__meta { font-size: var(--font-size-xs); color: var(--color-text-muted); }
.rules-objections__reason { overflow-wrap: anywhere; white-space: pre-wrap; }
</style>
