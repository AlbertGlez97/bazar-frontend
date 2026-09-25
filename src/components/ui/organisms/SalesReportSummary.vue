<template>
  <!-- Organismo: resumen de un reporte de ventas — cifra grande con conteo y
       desglose por persona (denso, para Modo Gestión). Presentacional: recibe
       todo por props (centavos enteros) y no sabe de dónde salen. -->
  <section
    class="sales-report-summary"
    aria-live="polite"
  >
    <div class="sales-report-summary__hero">
      <p class="sales-report-summary__label">
        {{ VOICE.reports.totalLabel }}
      </p>
      <p class="sales-report-summary__total">
        {{ formatMinorMoney(totalMinor) }}
      </p>
      <p class="sales-report-summary__meta">
        {{ plural(saleCount, 'venta', 'ventas') }} · {{ rangeLabel }}
      </p>
    </div>

    <p
      v-if="saleCount === 0"
      class="sales-report-summary__empty"
    >
      {{ VOICE.reports.empty }}
    </p>

    <div
      v-else
      class="sales-report-summary__table-wrap"
    >
      <table class="sales-report-summary__table">
        <caption class="sales-report-summary__caption">
          {{ VOICE.reports.byPerson }}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              {{ VOICE.reports.columnPerson }}
            </th>
            <th scope="col">
              {{ VOICE.reports.columnRole }}
            </th>
            <th
              scope="col"
              class="sales-report-summary__num"
            >
              {{ VOICE.reports.columnTotal }}
            </th>
            <th
              scope="col"
              class="sales-report-summary__num"
            >
              {{ VOICE.reports.columnShare }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="person in people"
            :key="person.memberId"
          >
            <td class="sales-report-summary__name">
              {{ person.name }}
            </td>
            <td>
              <AppBadge
                v-if="person.role"
                :color="person.role === 'socio' ? 'amber' : 'gray'"
              >
                {{ roleLabel(person.role) }}
              </AppBadge>
              <span v-else>—</span>
            </td>
            <td class="sales-report-summary__num">
              {{ formatMinorMoney(person.totalMinor) }}
            </td>
            <td class="sales-report-summary__num">
              {{ person.sharePercent.toFixed(1) }} %
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { VOICE } from '@/config/voice'
import { formatMinorMoney } from '@/utils/money'
import { plural, roleLabel } from '@/utils/sales-report'
import type { MemberRole } from '@/types/member.types'
import AppBadge from '../atoms/AppBadge.vue'

export interface SalesReportSummaryPerson {
  memberId: string
  name: string
  role: MemberRole | null
  totalMinor: number
  /** Porcentaje con un decimal. */
  sharePercent: number
}

defineProps<{
  /** Total vendido del periodo, en centavos. */
  totalMinor: number
  saleCount: number
  /** Periodo ya formateado para leerse (`24/09/2026` o `20/09/2026 al 26/09/2026`). */
  rangeLabel: string
  /** De mayor a menor venta. */
  people: SalesReportSummaryPerson[]
}>()
</script>

<style scoped>
.sales-report-summary {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.sales-report-summary__hero {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary-soft);
  border-radius: var(--radius-lg);
}
.sales-report-summary__label {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-hover);
}
.sales-report-summary__total {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-2xl);
  font-weight: 800;
  line-height: 1.2;
  color: var(--color-primary-hover);
}
.sales-report-summary__meta {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-primary-hover);
}

.sales-report-summary__empty {
  margin: 0;
  color: var(--color-text-muted);
}

.sales-report-summary__table-wrap {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.sales-report-summary__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.sales-report-summary__caption {
  padding: var(--spacing-sm) var(--spacing-md);
  font-weight: 700;
  text-align: left;
  color: var(--color-text);
}
.sales-report-summary__table th,
.sales-report-summary__table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-top: 1px solid var(--color-border);
}
.sales-report-summary__table th {
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  white-space: nowrap;
}
.sales-report-summary__num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sales-report-summary__name { font-weight: 600; color: var(--color-text); }
</style>
