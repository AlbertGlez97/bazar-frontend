<template>
  <!-- Organismo: "Abonos recibidos en el periodo" y "Deudas liquidadas en el
       periodo" (BE-15/D7), más el total combinado (ventas de contado +
       abonos reales). Presentacional, mismo patrón que SalesDetailBreakdown:
       recibe filas ya resueltas por props y no sabe de dónde salen. -->
  <section
    class="deudas-report-breakdown"
    aria-live="polite"
  >
    <div class="deudas-report-breakdown__section">
      <p
        v-if="abonosRecibidos.length === 0"
        class="deudas-report-breakdown__empty"
      >
        {{ VOICE.reports.emptyAbonos }}
      </p>
      <div
        v-else
        class="deudas-report-breakdown__table-wrap"
      >
        <table class="deudas-report-breakdown__table">
          <caption class="deudas-report-breakdown__caption">
            {{ VOICE.reports.byAbonos }}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {{ VOICE.reports.columnDate }}
              </th>
              <th scope="col">
                {{ VOICE.reports.columnDeudor }}
              </th>
              <th scope="col">
                {{ VOICE.reports.columnDeudaType }}
              </th>
              <th
                scope="col"
                class="deudas-report-breakdown__num"
              >
                {{ VOICE.reports.columnAmount }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(abono, i) in abonosRecibidos"
              :key="i"
            >
              <td>{{ formatDate(abono.fecha) }}</td>
              <td class="deudas-report-breakdown__name">
                {{ abono.deudor }}
              </td>
              <td>{{ deudaTypeLabel(abono.type) }}</td>
              <td class="deudas-report-breakdown__num">
                {{ formatMinorMoney(abono.montoMinor) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="deudas-report-breakdown__section">
      <p
        v-if="deudasLiquidadas.length === 0"
        class="deudas-report-breakdown__empty"
      >
        {{ VOICE.reports.emptyDeudasLiquidadas }}
      </p>
      <div
        v-else
        class="deudas-report-breakdown__table-wrap"
      >
        <table class="deudas-report-breakdown__table">
          <caption class="deudas-report-breakdown__caption">
            {{ VOICE.reports.byDeudasLiquidadas }}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                {{ VOICE.reports.columnDeudor }}
              </th>
              <th scope="col">
                {{ VOICE.reports.columnDeudaType }}
              </th>
              <th
                scope="col"
                class="deudas-report-breakdown__num"
              >
                {{ VOICE.reports.columnTotal }}
              </th>
              <th scope="col">
                {{ VOICE.reports.columnSaldadaAt }}
              </th>
              <th
                scope="col"
                class="deudas-report-breakdown__num"
              >
                {{ VOICE.reports.columnProfit }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="deuda in deudasLiquidadas"
              :key="deuda.id"
            >
              <td class="deudas-report-breakdown__name">
                {{ deuda.deudor }}
              </td>
              <td>{{ deudaTypeLabel(deuda.type) }}</td>
              <td class="deudas-report-breakdown__num">
                {{ formatMinorMoney(deuda.totalMinor) }}
              </td>
              <td>{{ formatDate(deuda.saldadaAt) }}</td>
              <td class="deudas-report-breakdown__num">
                {{ gananciaCellText(deuda) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="deudas-report-breakdown__total">
      <p class="deudas-report-breakdown__total-label">
        {{ VOICE.reports.totalIngresadoLabel }}
      </p>
      <p class="deudas-report-breakdown__total-value">
        {{ formatMinorMoney(totalIngresadoMinor) }}
      </p>
      <p class="deudas-report-breakdown__total-meta">
        {{ VOICE.reports.totalIngresadoHint }}
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { VOICE } from '@/config/voice'
import { formatMinorMoney } from '@/utils/money'
import { deudaTypeLabel, gananciaCellText } from '@/utils/sales-report'

export interface AbonoRecibidoBreakdownRow {
  fecha: string
  deudor: string
  montoMinor: number
  type: 'fiado' | 'apartado'
}

export interface DeudaLiquidadaBreakdownRow {
  id: string
  deudor: string
  type: 'fiado' | 'apartado'
  totalMinor: number
  saldadaAt: string
  /** `null` cuando `gananciaDisponible` es `false`. */
  gananciaMinor: number | null
  gananciaDisponible: boolean
}

defineProps<{
  abonosRecibidos: AbonoRecibidoBreakdownRow[]
  deudasLiquidadas: DeudaLiquidadaBreakdownRow[]
  /** `totalSoldMinor + abonosRecibidosMinor`, ya sumado. */
  totalIngresadoMinor: number
}>()

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}
</script>

<style scoped>
.deudas-report-breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.deudas-report-breakdown__section { display: flex; flex-direction: column; gap: var(--spacing-sm); }

.deudas-report-breakdown__empty {
  margin: 0;
  color: var(--color-text-muted);
}

.deudas-report-breakdown__table-wrap {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.deudas-report-breakdown__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}
.deudas-report-breakdown__caption {
  padding: var(--spacing-sm) var(--spacing-md);
  font-weight: 700;
  text-align: left;
  color: var(--color-text);
}
.deudas-report-breakdown__table th,
.deudas-report-breakdown__table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-top: 1px solid var(--color-border);
}
.deudas-report-breakdown__table th {
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  white-space: nowrap;
}
.deudas-report-breakdown__num { text-align: right !important; font-variant-numeric: tabular-nums; white-space: nowrap; }
.deudas-report-breakdown__name { font-weight: 600; color: var(--color-text); }

.deudas-report-breakdown__total {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary-soft);
  border-radius: var(--radius-lg);
}
.deudas-report-breakdown__total-label { margin: 0; font-size: var(--font-size-sm); font-weight: 600; color: var(--color-primary-hover); }
.deudas-report-breakdown__total-value {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--font-size-2xl);
  font-weight: 800;
  color: var(--color-primary-hover);
}
.deudas-report-breakdown__total-meta { margin: 0; font-size: var(--font-size-sm); color: var(--color-primary-hover); }
</style>
