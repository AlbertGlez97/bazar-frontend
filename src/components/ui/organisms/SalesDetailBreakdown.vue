<template>
  <!-- Organismo: desglose de ventas por producto y vendedor, con ganancia real
       (D4). Presentacional: recibe filas ya resueltas (nombre, texto de
       ganancia) por props y no sabe de dónde salen ni hace fetch. -->
  <section
    class="sales-detail-breakdown"
    aria-live="polite"
  >
    <p
      v-if="rows.length === 0"
      class="sales-detail-breakdown__empty"
    >
      {{ VOICE.reports.emptyProduct }}
    </p>

    <div
      v-else
      class="sales-detail-breakdown__table-wrap"
    >
      <table class="sales-detail-breakdown__table">
        <caption class="sales-detail-breakdown__caption">
          {{ VOICE.reports.byProduct }}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              {{ VOICE.reports.columnProduct }}
            </th>
            <th scope="col">
              {{ VOICE.reports.columnPerson }}
            </th>
            <th
              scope="col"
              class="sales-detail-breakdown__num"
            >
              {{ VOICE.reports.columnUnits }}
            </th>
            <th
              scope="col"
              class="sales-detail-breakdown__num"
            >
              {{ VOICE.reports.columnIncome }}
            </th>
            <th
              scope="col"
              class="sales-detail-breakdown__num"
            >
              {{ VOICE.reports.columnProfit }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="`${row.productId}-${row.memberId}`"
          >
            <td class="sales-detail-breakdown__name">
              {{ row.productName }}
            </td>
            <td>
              {{ row.memberName }}
            </td>
            <td class="sales-detail-breakdown__num">
              {{ row.units }}
            </td>
            <td class="sales-detail-breakdown__num">
              {{ formatMinorMoney(row.ingresoMinor) }}
            </td>
            <td class="sales-detail-breakdown__num">
              {{ gananciaCellText(row) }}
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
import { gananciaCellText } from '@/utils/sales-report'

export interface SalesDetailBreakdownRow {
  productId: string
  memberId: string
  productName: string
  memberName: string
  units: number
  ingresoMinor: number
  /** `null` cuando `gananciaDisponible` es `false`. */
  gananciaMinor: number | null
  gananciaDisponible: boolean
}

defineProps<{
  /** Filas del periodo (ya con nombres resueltos), en el orden que se quieran mostrar. */
  rows: SalesDetailBreakdownRow[]
}>()
</script>

<style scoped>
.sales-detail-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.sales-detail-breakdown__empty {
  margin: 0;
  color: var(--color-text-muted);
}

.sales-detail-breakdown__table-wrap {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.sales-detail-breakdown__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.sales-detail-breakdown__caption {
  padding: var(--spacing-sm) var(--spacing-md);
  font-weight: 700;
  text-align: left;
  color: var(--color-text);
}
.sales-detail-breakdown__table th,
.sales-detail-breakdown__table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-top: 1px solid var(--color-border);
}
.sales-detail-breakdown__table th {
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  white-space: nowrap;
}
.sales-detail-breakdown__num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.sales-detail-breakdown__name { font-weight: 600; color: var(--color-text); }
</style>
