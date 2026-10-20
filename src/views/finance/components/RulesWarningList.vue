<template>
  <AppAlert
    v-if="warnings.length"
    type="warning"
    title="Para tener en cuenta"
    data-test="rules-warnings"
  >
    <p class="rules-warning-list__lead">
      Son avisos, no errores. Puedes dejar las reglas como están.
    </p>
    <ul class="rules-warning-list">
      <li
        v-for="warning in warnings"
        :key="warning.code"
      >
        {{ warning.message }}
      </li>
    </ul>
  </AppAlert>
</template>

<script setup lang="ts">
import { AppAlert } from '@/components'
import type { RulesWarning } from '@/types/finance-rules.types'

defineProps<{ warnings: readonly RulesWarning[] }>()
</script>

<style scoped>
.rules-warning-list__lead { margin: 0 0 var(--spacing-xs); }
.rules-warning-list { margin: 0; padding-left: var(--spacing-md); }
</style>
