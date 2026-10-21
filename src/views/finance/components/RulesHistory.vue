<template>
  <section
    class="rules-history"
    aria-labelledby="rules-history-title"
    data-test="rules-history"
  >
    <h3 id="rules-history-title">
      Historial de versiones
    </h3>
    <p
      v-if="!items.length"
      class="rules-history__empty"
    >
      Aún no hay versiones enviadas a aprobación.
    </p>
    <ol
      v-else
      class="rules-history__list"
    >
      <li
        v-for="item in items"
        :key="item.id"
        class="rules-history__item"
        :data-test="`version-${item.version}`"
      >
        <div class="rules-history__head">
          <strong>Versión {{ item.version }}</strong>
          <AppBadge :color="BADGE[item.status]">
            {{ STATUS_TEXT[item.status] }}
          </AppBadge>
        </div>
        <p class="rules-history__meta">
          Propuso {{ item.proposedBy.name }}<template v-if="item.submittedAt">
            el {{ formatRuleDateTime(item.submittedAt) }}
          </template>.
          <template v-if="item.activatedAt">
            Entró en vigor el {{ formatRuleDateTime(item.activatedAt) }}.
          </template>
          <template v-if="item.supersededAt">
            La reemplazó una versión nueva el {{ formatRuleDateTime(item.supersededAt) }}.
          </template>
          <template v-if="item.inReviewAt && item.status === 'en_revision'">
            Pasó a revisión el {{ formatRuleDateTime(item.inReviewAt) }}.
          </template>
          <template v-if="item.discardedAt">
            Se descartó el {{ formatRuleDateTime(item.discardedAt) }}.
          </template>
          <template v-if="item.closedNote">
            {{ item.closedNote }}
          </template>
        </p>
        <ul
          class="rules-history__approvals"
          :aria-label="`Respuestas de la versión ${item.version}`"
        >
          <li
            v-for="approval in item.approvals"
            :key="approval.memberId"
          >
            {{ approval.name }} aprobó el {{ formatRuleDateTime(approval.approvedAt) }}.
            <span
              class="rules-history__origin"
              data-test="approval-origin"
            >{{ approvalSource(approval) }}</span>
          </li>
          <li
            v-for="objection in item.objections"
            :key="objection.memberId"
            class="rules-history__objection"
          >
            {{ objection.name }} no estuvo de acuerdo el {{ formatRuleDateTime(objection.createdAt) }}
            ({{ objection.correo }}): <q class="rules-history__reason">{{ objection.reason }}</q>
          </li>
          <li
            v-for="partner in item.missing"
            :key="partner.memberId"
            class="rules-history__missing"
          >
            {{ partner.name }} todavía no responde.
          </li>
        </ul>
        <details class="rules-history__details">
          <summary>Ver las reglas de esta versión</summary>
          <ul
            v-if="item.changes?.length"
            class="rules-history__changes"
            :aria-label="`Qué cambió en la versión ${item.version}`"
          >
            <li
              v-for="change in item.changes"
              :key="change.topic"
            >
              <strong>Cambió {{ change.topic }}.</strong> Antes: {{ change.before }} Ahora: {{ change.after }}
            </li>
          </ul>
          <ul>
            <li
              v-for="line in versionSummary(item.config)"
              :key="line"
            >
              {{ line }}
            </li>
          </ul>
        </details>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { AppBadge } from '@/components'
import { STATUS_TEXT, approvalSource, formatRuleDateTime, versionSummary } from '@/utils/finance-rules'
import type { RuleSetStatus, RuleSetView } from '@/types/finance-rules.types'

defineProps<{ items: readonly RuleSetView[] }>()

const BADGE: Record<RuleSetStatus, 'green' | 'amber' | 'gray' | 'blue'> = {
  vigente: 'green',
  pendiente: 'amber',
  en_revision: 'amber',
  reemplazada: 'gray',
  descartada: 'gray',
  retirada: 'gray',
  borrador: 'blue',
}
</script>

<style scoped>
.rules-history { display: grid; gap: var(--spacing-sm); }
.rules-history h3 { margin: 0; font-size: var(--font-size-md); }
.rules-history__empty { margin: 0; color: var(--color-text-muted); }
.rules-history__list { display: grid; gap: var(--spacing-sm); margin: 0; padding: 0; list-style: none; }
.rules-history__item {
  display: grid; gap: var(--spacing-xs); padding: var(--spacing-sm);
  border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface);
}
.rules-history__head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-xs); }
.rules-history__meta, .rules-history__approvals { margin: 0; font-size: var(--font-size-sm); color: var(--color-text-muted); }
.rules-history__approvals { padding-left: var(--spacing-md); }
.rules-history__missing { color: var(--color-warning); }
.rules-history__reason { overflow-wrap: anywhere; white-space: pre-wrap; }
.rules-history__changes { margin-bottom: var(--spacing-xs); }
.rules-history__origin { display: block; font-size: var(--font-size-xs); }
.rules-history__details summary { min-height: 44px; display: flex; align-items: center; cursor: pointer; color: var(--color-primary); font-weight: 600; }
.rules-history__details ul { margin: 0; padding-left: var(--spacing-md); font-size: var(--font-size-sm); }
</style>
