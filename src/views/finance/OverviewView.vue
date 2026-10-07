<template>
  <section
    v-if="allowed"
    class="overview-page"
    data-test="overview-page"
  >
    <TabNav
      label="Secciones de Finanzas"
      :tabs="FINANCE_TABS"
      active="/app/finanzas/resumen"
    />
    <header>
      <p>Finanzas</p>
      <h1>Resumen</h1>
      <p>
        Una mirada tranquila a lo que está registrado en el periodo: ventas,
        costos, gastos, aportaciones y trabajo. Solo lee datos confirmados por
        el servidor; no es el efectivo que tienes ni una recomendación de retiro.
      </p>
    </header>

    <AppCard>
      <ReportRangePicker
        :from="range.from"
        :to="range.to"
        :preset="preset"
        :error="rangeError"
        :disabled="finance.loading"
        @select-preset="selectPreset"
        @update:from="onFrom"
        @update:to="onTo"
        @apply="refresh"
      />
    </AppCard>

    <div
      class="overview-status"
      aria-live="polite"
      data-test="status"
    >
      <p v-if="finance.loading && data">
        Actualizando el resumen…
      </p>
      <template v-if="data">
        <p
          data-test="freshness"
          class="overview-muted"
        >
          {{ finance.isStale ? 'Último resumen confirmado' : 'Última actualización' }}:
          {{ formatBusinessDateTime(data.generatedAt) }}.
          <template v-if="shownPeriodText">
            Periodo mostrado: {{ shownPeriodText }}.
          </template>
        </p>
        <p
          data-test="pending-note"
          class="overview-muted"
        >
          Los registros pendientes de sincronizar en este dispositivo no están
          incluidos en este resumen.
        </p>
        <div
          v-if="data.costCoverage.status === 'partial'"
          class="overview-notice"
          data-test="coverage-partial"
        >
          <p><strong>Hay ventas sin costo registrado.</strong></p>
          <p>{{ coverageText(data.costCoverage) }}</p>
          <p>{{ missingCoverageText(data.costCoverage) }}</p>
          <p>
            Ventas de líneas sin costo:
            {{ formatMinorMoney(data.costCoverage.salesWithoutCostMinor) }}. El
            costo vendido, el margen y el resultado se muestran como parciales.
          </p>
        </div>
        <p
          v-else
          class="overview-muted"
          data-test="coverage-complete"
        >
          {{ coverageText(data.costCoverage) }}
        </p>
      </template>
    </div>

    <AppAlert
      v-if="finance.error"
      type="error"
      title="No se pudo actualizar el resumen"
    >
      <p>{{ finance.error }}</p>
      <p v-if="data">
        Se conserva el último resumen confirmado; no es una actualización nueva.
      </p>
      <AppButton
        v-if="finance.retryable"
        variant="ghost"
        :disabled="finance.loading"
        data-test="retry"
        @click="refresh"
      >
        Reintentar
      </AppButton>
    </AppAlert>

    <div
      v-if="finance.loading && !data"
      class="overview-skeleton"
      data-test="skeleton"
      role="status"
      aria-label="Cargando el resumen"
    >
      <AppSkeleton
        v-for="n in 4"
        :key="n"
        height="5rem"
        rounded
      />
    </div>

    <p
      v-else-if="data && !hasRecordedActivity(data)"
      class="overview-empty"
      data-test="empty"
    >
      No hay ventas ni movimientos registrados en este periodo.
    </p>

    <template v-else-if="data">
      <section
        class="overview-flow"
        aria-labelledby="ov-result"
        data-test="operating"
      >
        <h2 id="ov-result">
          Resultado operativo registrado
        </h2>
        <div class="overview-grid">
          <OverviewFigure
            label="Ventas"
            :minor="data.sales.salesMinor"
            :note="`${data.sales.saleCount} ${data.sales.saleCount === 1 ? 'venta completada' : 'ventas completadas'}`"
          />
          <OverviewFigure
            label="Costo vendido registrado"
            :minor="data.sales.recordedCostMinor"
            :partial="isPartial"
          />
          <OverviewFigure
            label="Margen bruto registrado"
            :minor="data.sales.recordedGrossMarginMinor"
            :partial="isPartial"
            note="Ventas menos costo vendido registrado."
          />
          <OverviewFigure
            label="Gastos operativos"
            :minor="data.expenses.operatingMinor"
          />
          <OverviewFigure
            class="overview-grid__wide"
            label="Resultado operativo registrado"
            :minor="data.result.recordedOperatingResultMinor"
            :partial="data.result.status === 'partial'"
            prominent
            note="Margen bruto registrado menos gastos operativos."
          />
        </div>
      </section>

      <section
        class="overview-block overview-block--inventory"
        aria-labelledby="ov-inventory"
        data-test="inventory"
      >
        <h2 id="ov-inventory">
          Compras de inventario
        </h2>
        <OverviewFigure
          label="Compras de inventario del periodo"
          :minor="data.expenses.inventoryPurchasesMinor"
        />
        <p class="overview-muted">
          Comprar mercancía no es lo mismo que el costo de lo que se vende: ese
          costo ya está en el costo vendido registrado. Por eso estas compras
          no se suman a los gastos operativos ni al resultado.
        </p>
      </section>

      <section
        class="overview-block"
        aria-labelledby="ov-capital"
        data-test="contributions"
      >
        <h2 id="ov-capital">
          Capital aportado registrado
        </h2>
        <OverviewFigure
          label="Aportaciones del periodo"
          :minor="data.contributions.amountMinor"
          :note="`${data.contributions.count} ${data.contributions.count === 1 ? 'aportación' : 'aportaciones'}`"
        />
        <p class="overview-muted">
          Es dinero que las personas socias pusieron al negocio. No es ingreso
          ni se suma al resultado operativo.
        </p>
      </section>

      <section
        class="overview-block"
        aria-labelledby="ov-work"
        data-test="work"
      >
        <h2 id="ov-work">
          Trabajo registrado
        </h2>
        <p data-test="work-total">
          {{ describeWorkShiftTotals(data.workShifts) }}
        </p>
        <ul
          v-if="finance.partners?.members.length"
          class="overview-people"
          data-test="partners"
        >
          <li
            v-for="entry in finance.partners.members"
            :key="entry.memberId"
            data-test="partner"
          >
            <h3>{{ entry.member?.name ?? 'Miembro sin nombre registrado' }}</h3>
            <p>{{ describeWorkShiftTotals(entry) }}</p>
          </li>
        </ul>
        <p
          v-else-if="!finance.partners"
          class="overview-muted"
          data-test="partners-unavailable"
        >
          No pudimos cargar el detalle por persona. Se muestran solo los
          totales.
        </p>
        <p class="overview-muted">
          Las jornadas solo dejan constancia del trabajo; no calculan pagos.
        </p>
      </section>

      <section
        class="overview-block"
        aria-labelledby="ov-reserves"
        data-test="reserves"
      >
        <h2 id="ov-reserves">
          Reservas
        </h2>
        <OverviewFigure
          label="Reservas planeadas para este periodo"
          :minor="data.reserves.plannedMinor"
          :note="`${data.reserves.activeCount} ${data.reserves.activeCount === 1 ? 'reserva activa' : 'reservas activas'}`"
        />
        <p
          class="overview-muted"
          data-test="reserves-explain"
        >
          Una reserva es un monto que planeas apartar; no es efectivo guardado
          ni un pago. Solo se restan las reservas creadas para exactamente este
          período{{ reservesPeriodSuffix }}: una reserva de otro período no cambia esta cifra.
        </p>
        <p
          v-if="data.reserves.activeCount === 0"
          class="overview-muted"
          data-test="reserves-none"
        >
          Todavía no hay reservas activas para este período.
        </p>
        <RouterLink
          :to="reservesLink"
          class="overview-link"
          data-test="reserves-link"
        >
          Administrar reservas
        </RouterLink>
      </section>

      <section
        class="overview-block overview-block--available"
        aria-labelledby="ov-available"
        data-test="available"
      >
        <h2 id="ov-available">
          Monto potencialmente disponible
        </h2>
        <OverviewFigure
          label="Monto potencialmente disponible"
          :minor="data.result.potentiallyAvailableMinor"
          :partial="data.result.status === 'partial'"
        />
        <p data-test="available-disclaimer">
          {{ AVAILABLE_DISCLAIMER }}
        </p>
      </section>

      <section
        v-if="warnings.length"
        class="overview-block"
        aria-labelledby="ov-notes"
        data-test="warnings"
      >
        <h2 id="ov-notes">
          Para tener en cuenta
        </h2>
        <ul>
          <li
            v-for="text in warnings"
            :key="text"
          >
            {{ text }}
          </li>
        </ul>
      </section>
    </template>
  </section>
  <p v-else>
    Solo socios pueden ver el resumen de Finanzas en Gestión.
  </p>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import {
  AppAlert,
  AppButton,
  AppCard,
  AppSkeleton,
  ReportRangePicker,
  TabNav,
} from '@/components'
import { RouterLink } from 'vue-router'
import { useUiModeStore } from '@/stores/uiMode.store'
import { useSessionStore } from '@/stores/session.store'
import { useFinanceOverviewStore } from '@/stores/finance-overview.store'
import {
  businessToday,
  formatDateKey,
  formatBusinessDateTime,
  presetRange,
  validateRange,
  type RangePreset,
} from '@/utils/business-time'
import { formatMinorMoney } from '@/utils/money'
import { formatPickedPeriod } from '@/utils/finance-reserves'
import {
  coverageText,
  extraWarnings,
  hasRecordedActivity,
  missingCoverageText,
} from '@/utils/finance-overview'
import { describeWorkShiftTotals } from '@/utils/work-shift-summary'
import { FINANCE_TABS } from './finance-tabs'
import OverviewFigure from './components/OverviewFigure.vue'

const AVAILABLE_DISCLAIMER =
  'Este cálculo considera el resultado operativo registrado y las reservas configuradas. No representa necesariamente efectivo disponible ni una recomendación de retiro.'

const session = useSessionStore(),
  mode = useUiModeStore(),
  finance = useFinanceOverviewStore()
const allowed = computed(
  () => session.member?.role === 'socio' && mode.currentMode === 'gestion',
)

const today = ref(businessToday())
/** The period end may be in the future (e.g. a full month) so reserves can match it. */
const FUTURE_END_OK = { allowFuture: true } as const
const initial = presetRange('mes')
const range = reactive({ from: initial.from, to: initial.to })
const preset = ref<RangePreset | null>('mes')
const rangeError = computed(() => {
  const problem = validateRange(range.from, range.to, today.value, FUTURE_END_OK)
  return problem === 'incomplete'
    ? 'Escribe las dos fechas para consultar el resumen.'
    : problem === 'inverted'
      ? 'La fecha inicial es posterior a la final. Cámbialas para consultar.'
      : undefined
})

const data = computed(() => finance.overview)
const isPartial = computed(() => data.value?.costCoverage.status === 'partial')
const warnings = computed(() => (data.value ? extraWarnings(data.value.warnings) : []))
/** Only spelled out when the data on screen is not for the period currently selected. */
const shownPeriodText = computed(() => {
  const shown = finance.period
  if (!shown || (shown.from === range.from && shown.to === range.to)) return ''
  return `${formatDateKey(shown.from)} al ${formatDateKey(shown.to)}`
})

/** Reserves only count for the EXACT period on screen, so the link carries it. */
const reservesPeriodText = computed(() => (finance.period ? formatPickedPeriod(finance.period) : ''))
/** " (dd/mm/aaaa al dd/mm/aaaa)" with its leading space, or nothing: keeps the colon glued to the parenthesis. */
const reservesPeriodSuffix = computed(() => (reservesPeriodText.value ? ` (${reservesPeriodText.value})` : ''))
const reservesLink = computed(() => ({
  path: '/app/finanzas/reservas',
  query: finance.period ? { from: finance.period.from, to: finance.period.to } : {},
}))

function refresh() {
  if (!allowed.value || rangeError.value) return
  void finance.load({ from: range.from, to: range.to })
}
function selectPreset(next: RangePreset) {
  const value = presetRange(next)
  range.from = value.from
  range.to = value.to
  preset.value = next
  refresh()
}
function onFrom(value: string) {
  range.from = value
  preset.value = null
}
function onTo(value: string) {
  range.to = value
  preset.value = null
}

watch(allowed, (value) => {
  if (value) refresh()
  else finance.reset()
})
onMounted(refresh)
</script>

<style scoped>
.overview-page {
  display: grid;
  gap: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
  min-width: 0;
}
.overview-page h2 {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-lg);
}
.overview-page h3 {
  margin: 0;
  font-size: var(--font-size-md);
}
.overview-flow,
.overview-block {
  display: grid;
  gap: var(--spacing-md);
  align-content: start;
  min-width: 0;
}
.overview-flow > h2,
.overview-block > h2 {
  margin: 0;
}
.overview-grid {
  display: grid;
  gap: var(--spacing-md);
}
.overview-grid > * {
  min-width: 0;
}
.overview-block {
  padding: var(--spacing-md);
  background: var(--color-surface-alt);
  border-radius: var(--radius-lg);
}
.overview-block--inventory {
  border: 1px dashed var(--color-border-strong);
}
.overview-block--available {
  border: 1px solid var(--color-info);
  background: var(--color-info-soft);
}
.overview-status {
  display: grid;
  gap: var(--spacing-sm);
}
.overview-status p,
.overview-notice p {
  margin: 0;
}
.overview-muted {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
}
.overview-notice {
  display: grid;
  gap: var(--spacing-xs);
  padding: var(--spacing-md);
  background: var(--color-warning-soft);
  color: var(--color-text);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
}
.overview-link {
  justify-self: start;
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: underline;
  min-height: 2.75rem;
  display: inline-flex;
  align-items: center;
}
.overview-empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--color-text-muted);
  background: var(--color-surface-alt);
  border-radius: var(--radius-lg);
}
.overview-skeleton {
  display: grid;
  gap: var(--spacing-md);
}
.overview-people {
  list-style: none;
  display: grid;
  gap: var(--spacing-sm);
  padding: 0;
  margin: 0;
}
.overview-people li {
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--color-border);
}
@media (min-width: 768px) {
  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .overview-grid__wide {
    grid-column: 1 / -1;
  }
}
</style>
