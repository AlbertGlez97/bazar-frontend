<template>
  <div class="dash">

    <!-- ── Banner: cifrado degradado ─────────────────────────────────── -->
    <AppAlert v-if="store.degraded" type="warning">
      {{ BANNER_DEGRADED_COPY }}
    </AppAlert>

    <!-- ── Estado de carga ─────────────────────────────────────────── -->
    <div v-if="store.loading" class="dash__loading">
      <div class="dash__spinner"></div>
      <p>Cargando tu resumen financiero…</p>
    </div>

    <!-- ── Estado de error ────────────────────────────────────────── -->
    <div v-else-if="store.error" class="dash__error">
      <span>⚠️</span>
      <p>{{ store.error }}</p>
      <AppButton variant="primary" @click="store.fetchDashboard()">Reintentar</AppButton>
    </div>

    <!-- ── Contenido ──────────────────────────────────────────────── -->
    <template v-else-if="store.dashboard">

      <!-- Sub-header: mes activo + acciones rápidas + selector de año -->
      <div class="dash__subheader">
        <div class="dash__period">
          <span class="dash__period-label">Período activo</span>
          <span class="dash__period-value">
            {{ store.dashboard.mesActual.mes }} {{ store.dashboard.mesActual.anio }}
          </span>
        </div>
        <div class="dash__quick-actions" v-if="store.hasBudget">
          <AppButton variant="primary" size="sm" :loading="navigating" @click="quickOpen('income')">+ Agregar Ingreso</AppButton>
          <AppButton variant="secondary" size="sm" :loading="navigating" @click="quickOpen('transaction')">+ Agregar Gasto</AppButton>
        </div>
        <div class="dash__year-selector">
          <AppButton variant="ghost" size="sm" @click="changeYear(-1)">‹</AppButton>
          <span class="dash__year">{{ selectedYear }}</span>
          <AppButton variant="ghost" size="sm" @click="changeYear(1)">›</AppButton>
          <!-- Exportar reporte financiero del año seleccionado a Excel.
               El estado de carga deshabilita el botón y cambia el texto. -->
          <button
            type="button"
            class="btn-export"
            :disabled="exporting"
            :title="exporting ? 'Generando archivo…' : 'Descargar reporte financiero del año'"
            @click="downloadReport"
          >
            <span v-if="!exporting">📥 Descargar reporte</span>
            <span v-else>⏳ Generando…</span>
          </button>
          <!-- Ayuda contextual: abre el drawer con "¿Qué es FinanzasApp?".
               Lo metemos en el cluster de la derecha para que el dash__subheader
               siga siendo un space-between de 3 grupos (período / acciones / cluster). -->
          <button
            type="button"
            class="btn-help"
            aria-label="Ayuda"
            title="Ayuda"
            @click="helpOpen = true"
          >?</button>
        </div>
      </div>

      <!-- ── Banner: sin presupuesto del mes ───────────────────────── -->
      <div v-if="!store.hasBudget" class="dash__empty-banner">
        <div class="dash__empty-banner__icon">📋</div>
        <div>
          <strong>No tienes presupuesto para {{ store.dashboard.mesActual.mes }}</strong>
          <p>Crea el presupuesto del mes para comenzar a registrar ingresos y gastos.</p>
        </div>
        <AppButton tag="RouterLink" to="/budget" variant="primary" size="sm">Crear presupuesto →</AppButton>
      </div>

      <!-- ── Fila 1: tarjetas métricas ─────────────────────────────── -->
      <div class="dash__metrics">

        <!-- Ingreso total -->
        <div class="metric-card metric-card--blue">
          <div class="metric-card__header">
            <span class="metric-card__label">Ingreso mensual</span>
            <span class="metric-card__icon">💰</span>
          </div>
          <div class="metric-card__value">
            {{ fmt(store.dashboard.mesActual.totalIngreso ?? 0) }}
          </div>
          <div class="metric-card__sub">{{ store.dashboard.mesActual.mes }} {{ store.dashboard.mesActual.anio }}</div>
        </div>

        <!-- Gastado -->
        <div class="metric-card" :class="spentClass">
          <div class="metric-card__header">
            <span class="metric-card__label">Total gastado</span>
            <span class="metric-card__icon">💳</span>
          </div>
          <div class="metric-card__value">
            {{ fmt(store.dashboard.mesActual.totalGastado ?? 0) }}
          </div>
          <div class="metric-card__progress-wrap">
            <div class="metric-card__progress">
              <div
                class="metric-card__progress-fill"
                :style="{ width: store.spentPercent + '%' }"
              ></div>
            </div>
            <span class="metric-card__pct">{{ store.spentPercent }}%</span>
          </div>
        </div>

        <!-- Disponible real — ingresos − facturas − gastos − pagos mínimos pendientes -->
        <div class="metric-card" :class="disponibleReal >= 0 ? 'metric-card--green' : 'metric-card--red'">
          <div class="metric-card__header">
            <span class="metric-card__label">Disponible real</span>
            <span class="metric-card__icon">{{ disponibleReal >= 0 ? '✅' : '⚠️' }}</span>
          </div>
          <div class="metric-card__value">
            {{ fmt(disponibleReal) }}
          </div>
          <div class="metric-card__sub">
            <template v-if="debtsStore.totalPendienteEsteMes > 0">
              Ya descontamos {{ fmt(debtsStore.totalPendienteEsteMes) }} de tus deudas del mes.
            </template>
            <template v-else>
              {{ disponibleReal >= 0 ? 'Sin pagos de deuda pendientes' : 'Déficit del mes' }}
            </template>
          </div>

          <!-- Chip: pagos mínimos de deudas pendientes este mes -->
          <button
            v-if="debtsStore.pagosPendientesEsteMes.length > 0"
            class="metric-card__chip"
            type="button"
            @click="router.push({ name: 'Debts' })"
            :title="'Ir a Deudas'"
          >
            <span class="metric-card__chip-icon">⚠️</span>
            <span class="metric-card__chip-text">
              {{ debtsStore.pagosPendientesEsteMes.length }}
              {{ debtsStore.pagosPendientesEsteMes.length === 1 ? 'pago pendiente' : 'pagos pendientes' }}
              · {{ fmt(debtsStore.totalPendienteEsteMes) }}
            </span>
            <span class="metric-card__chip-arrow">→</span>
          </button>
        </div>

        <!-- Deuda restante -->
        <div class="metric-card metric-card--orange">
          <div class="metric-card__header">
            <span class="metric-card__label">Deuda total activa</span>
            <span class="metric-card__icon">📉</span>
          </div>
          <div class="metric-card__value">
            {{ fmt(store.dashboard.deudas.totalRestante) }}
          </div>
          <div class="metric-card__sub">
            {{ store.dashboard.deudas.porcentajeAvance }}% liquidado ·
            {{ store.dashboard.deudas.deudasActivas }} deuda{{ store.dashboard.deudas.deudasActivas !== 1 ? 's' : '' }} activa{{ store.dashboard.deudas.deudasActivas !== 1 ? 's' : '' }}
          </div>
        </div>

      </div>

      <!-- ── Fila 2: gráfica anual + progreso de deudas ────────────── -->
      <div class="dash__row2">

        <!-- Gráfica de barras anual -->
        <div class="card dash__chart-card">
          <div class="card__header">
            <h3 class="card__title">Ingreso vs Gasto · {{ selectedYear }}</h3>
            <span class="dash__chart-legend">
              <span class="dot dot--blue"></span> Ingreso
              <span class="dot dot--red"></span> Gasto
            </span>
          </div>

          <div
            v-if="store.annual"
            class="dash__chart"
            @mouseleave="onChartLeave"
          >
            <div
              v-for="(mes, idx) in store.annual.meses"
              :key="mes.numero"
              class="dash__chart-col"
              @mouseenter="onColEnter(mes, idx)"
            >
              <div class="dash__chart-bars">
                <!-- Barras: el detalle numérico vive solo en el tooltip al
                     hover, no se imprime sobre la barra. -->
                <div class="dash__bar dash__bar--blue" :style="{ height: barHeight(mes.ingreso ?? 0) }"></div>
                <div class="dash__bar dash__bar--red"  :style="{ height: barHeight(mes.gastado ?? 0) }"></div>
              </div>
              <span class="dash__chart-label">{{ mes.mes.slice(0, 3) }}</span>
            </div>

            <!-- Tooltip flotante anclado a la columna activa.
                 Position: absolute al contenedor; left% calculado por índice
                 para centrarse sobre la columna. pointer-events:none para no
                 bloquear el hover entre columnas adyacentes. -->
            <div
              v-if="hoveredMonth"
              class="dash__chart-tooltip"
              :style="tooltipStyle"
              role="tooltip"
            >
              <div class="dash__chart-tooltip__title">
                {{ hoveredMonth.mes.slice(0, 3) }} {{ selectedYear }}
              </div>
              <div class="dash__chart-tooltip__row">
                <span class="dot dot--blue"></span>
                <span class="dash__chart-tooltip__label">Ingreso</span>
                <strong>{{ fmt(hoveredMonth.ingreso ?? 0) }}</strong>
              </div>
              <div class="dash__chart-tooltip__row">
                <span class="dot dot--red"></span>
                <span class="dash__chart-tooltip__label">Gasto</span>
                <strong>{{ fmt(hoveredMonth.gastado ?? 0) }}</strong>
              </div>
              <div
                class="dash__chart-tooltip__row dash__chart-tooltip__balance"
                :class="hoveredBalance >= 0 ? 'is-positive' : 'is-negative'"
              >
                <span class="dash__chart-tooltip__label">Balance</span>
                <strong>{{ fmt(hoveredBalance) }}</strong>
              </div>
            </div>
          </div>

          <!-- Skeleton si no hay datos anuales -->
          <div v-else class="dash__chart dash__chart--skeleton">
            <div v-for="i in 12" :key="i" class="dash__chart-col">
              <div class="dash__chart-bars">
                <div class="dash__bar dash__bar--skeleton" :style="{ height: Math.random() * 60 + 20 + 'px' }"></div>
                <div class="dash__bar dash__bar--skeleton" :style="{ height: Math.random() * 60 + 10 + 'px' }"></div>
              </div>
              <span class="dash__chart-label dash__chart-label--skeleton"></span>
            </div>
          </div>

          <!-- Totales del año -->
          <div v-if="store.annual" class="dash__chart-totals">
            <span>Total ingreso: <strong>{{ fmt(store.annual.totales.ingreso) }}</strong></span>
            <span>Total gasto: <strong>{{ fmt(store.annual.totales.gastado) }}</strong></span>
            <span :class="store.annual.totales.balance >= 0 ? 'text-green' : 'text-red'">
              Balance: <strong>{{ fmt(store.annual.totales.balance) }}</strong>
            </span>
          </div>
        </div>

        <!-- Panel de deudas -->
        <div class="card dash__debt-card">
          <div class="card__header">
            <h3 class="card__title">Estado de Deudas</h3>
            <RouterLink to="/debts" class="card__link">Ver todo →</RouterLink>
          </div>

          <!-- Barra de progreso global -->
          <div class="debt-progress">
            <div class="debt-progress__bar">
              <div
                class="debt-progress__fill"
                :style="{ width: store.dashboard.deudas.porcentajeAvance + '%' }"
              ></div>
            </div>
            <div class="debt-progress__labels">
              <span>{{ store.dashboard.deudas.porcentajeAvance }}% liquidado</span>
              <span>{{ fmt(store.dashboard.deudas.totalRestante) }} restante</span>
            </div>
          </div>

          <!-- Métricas de deuda -->
          <div class="debt-stats">
            <div class="debt-stat">
              <span class="debt-stat__label">Deuda inicial</span>
              <span class="debt-stat__value">{{ fmt(store.dashboard.deudas.totalInicial) }}</span>
            </div>
            <div class="debt-stat">
              <span class="debt-stat__label">Ya pagado</span>
              <span class="debt-stat__value text-green">{{ fmt(store.dashboard.deudas.totalPagado) }}</span>
            </div>
            <div class="debt-stat">
              <span class="debt-stat__label">Pago mínimo/mes</span>
              <span class="debt-stat__value">{{ fmt(store.dashboard.deudas.pagoMinimoMensual) }}</span>
            </div>
            <div class="debt-stat">
              <span class="debt-stat__label">Libertad estimada</span>
              <span class="debt-stat__value text-blue">
                {{ store.dashboard.deudas.fechaEstimadaLibertad
                  ? fmtDate(store.dashboard.deudas.fechaEstimadaLibertad)
                  : '—' }}
              </span>
            </div>
          </div>

          <!-- Chips de deudas activas / liquidadas (átomo AppBadge) -->
          <div class="debt-chips">
            <AppBadge color="amber" filled>{{ store.dashboard.deudas.deudasActivas }} activas</AppBadge>
            <AppBadge color="green" filled>{{ store.dashboard.deudas.deudasLiquidadas }} liquidadas</AppBadge>
            <AppBadge v-if="store.dashboard.deudas.mesesParaLibertad" color="blue" filled>
              {{ store.dashboard.deudas.mesesParaLibertad }} meses para liberarse
            </AppBadge>
          </div>
        </div>

      </div>

      <!-- ── Fila 3: top gastos + ahorros ──────────────────────────── -->
      <div class="dash__row3">

        <!-- Top 5 categorías de gasto -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">Top categorías de gasto · {{ selectedYear }}</h3>
          </div>
          <div v-if="store.dashboard.topGastos.top5.length > 0" class="top-list">
            <div
              v-for="item in store.dashboard.topGastos.top5"
              :key="item.categoria"
              class="top-item"
            >
              <span class="top-item__pos">{{ item.posicion }}</span>
              <div class="top-item__info">
                <span class="top-item__name">{{ formatCategory(item.categoria) }}</span>
                <!-- AppBadge según tipo de gasto -->
                <AppBadge :color="item.tipo === 'necesidad' ? 'blue' : 'purple'" filled>
                  {{ item.tipo }}
                </AppBadge>
              </div>
              <div class="top-item__bar-wrap">
                <div class="top-item__bar">
                  <div
                    class="top-item__fill"
                    :style="{ width: item.porcentaje + '%', background: item.tipo === 'necesidad' ? 'var(--color-primary)' : 'var(--color-warning)' }"
                  ></div>
                </div>
                <span class="top-item__pct">{{ item.porcentaje }}%</span>
              </div>
              <span class="top-item__amount">{{ fmt(item.total) }}</span>
            </div>
          </div>
          <div v-else class="dash__no-data">
            <span>📊</span>
            <p>Sin transacciones registradas en {{ selectedYear }}</p>
          </div>
        </div>

        <!-- Metas de ahorro -->
        <div class="card">
          <div class="card__header">
            <h3 class="card__title">Metas de Ahorro</h3>
            <RouterLink to="/savings" class="card__link">Ver todo →</RouterLink>
          </div>

          <!-- Progreso global -->
          <div class="savings-global">
            <div class="savings-global__ring">
              <svg viewBox="0 0 36 36" class="savings-ring">
                <path
                  class="savings-ring__bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  class="savings-ring__fill"
                  :stroke-dasharray="`${store.dashboard.ahorros.porcentajeGlobal}, 100`"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.35" class="savings-ring__text">
                  {{ store.dashboard.ahorros.porcentajeGlobal }}%
                </text>
              </svg>
            </div>
            <div class="savings-global__stats">
              <div class="savings-stat">
                <span class="savings-stat__label">Ahorrado</span>
                <span class="savings-stat__value text-green">{{ fmt(store.dashboard.ahorros.totalAhorrado) }}</span>
              </div>
              <div class="savings-stat">
                <span class="savings-stat__label">Objetivo total</span>
                <span class="savings-stat__value">{{ fmt(store.dashboard.ahorros.totalObjetivo) }}</span>
              </div>
              <div class="savings-stat">
                <span class="savings-stat__label">Faltante</span>
                <span class="savings-stat__value text-orange">{{ fmt(store.dashboard.ahorros.totalFaltante) }}</span>
              </div>
            </div>
          </div>

          <!-- Meta más próxima -->
          <div v-if="store.dashboard.ahorros.proximaMeta" class="savings-next">
            <div class="savings-next__header">
              <span class="savings-next__label">Meta más próxima</span>
              <AppBadge color="green" filled>{{ store.dashboard.ahorros.proximaMeta.progreso }}%</AppBadge>
            </div>
            <p class="savings-next__name">{{ store.dashboard.ahorros.proximaMeta.nombre }}</p>
            <div class="savings-next__bar">
              <div
                class="savings-next__fill"
                :style="{ width: store.dashboard.ahorros.proximaMeta.progreso + '%' }"
              ></div>
            </div>
            <span class="savings-next__faltante">
              Faltan {{ fmt(store.dashboard.ahorros.proximaMeta.faltante) }}
            </span>
          </div>

          <!-- Fondo de emergencias -->
          <div v-if="store.dashboard.ahorros.fondoEmergencias" class="savings-emergency">
            <div class="savings-emergency__header">
              <span>🛡️ Fondo de emergencias</span>
              <AppBadge color="blue" filled>{{ store.dashboard.ahorros.fondoEmergencias.progreso }}%</AppBadge>
            </div>
            <div class="savings-next__bar" style="margin-top: 8px">
              <div
                class="savings-next__fill"
                :style="{ width: store.dashboard.ahorros.fondoEmergencias.progreso + '%', background: 'var(--color-info)' }"
              ></div>
            </div>
          </div>

          <!-- Sin metas -->
          <div v-if="store.dashboard.ahorros.totalMetas === 0" class="dash__no-data">
            <span>🐷</span>
            <p>Aún no tienes metas de ahorro</p>
            <AppButton tag="RouterLink" to="/savings" variant="primary" size="sm">Crear meta →</AppButton>
          </div>
        </div>

      </div>

    </template>

    <!-- Drawer de ayuda contextual del Dashboard — siempre el mismo slug.
         Slug fijo porque el dashboard no tiene tabs internos como
         BudgetDetail/DebtsView. -->
    <AppHelpDrawer slug="que-es-finanzasapp" :open="helpOpen" @close="helpOpen = false" />

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '@/stores/dashboard.store'
import { useBudgetStore } from '@/stores/budget.store'
import { useDebtsStore } from '@/stores/debts.store'
import { useSavingsStore } from '@/stores/savings.store'
import { AppButton, AppBadge, AppAlert, AppHelpDrawer } from '@/components'
import {
  exportFinancialReport,
  type ExportBudget,
  type ExportDebt,
  type ExportSavingGoal,
  type ExportAmortizationRow,
  type ExportSavingContribution,
} from '@/utils/exportToExcel'
import { computeGoalProjection } from '@/views/savings/savings.projection'

// Estado local del drawer de ayuda contextual
const helpOpen = ref(false)

// ── Constante de copia para el banner de estado degradado E2EE ────────────────
const BANNER_DEGRADED_COPY = 'Datos protegidos. Desbloqueá tu cifrado para visualizar tu información.'

const router       = useRouter()
const store        = useDashboardStore()
const budgetStore  = useBudgetStore()
const debtsStore   = useDebtsStore()
const savingsStore = useSavingsStore()

/**
 * Disponible real: lo que te muestra el backend menos el pago mínimo de las
 * deudas activas que todavía NO tienen pago registrado este mes calendario.
 * Ver Opción C en debts.store: al registrar un pago, se crea una transacción
 * automática en el budget activo, así que el pago queda reflejado en
 * `totalGastado` y `totalPendienteEsteMes` cae a 0 para esa deuda. Sin doble
 * contabilización.
 */
const disponibleReal = computed(() => {
  const base = store.dashboard?.mesActual?.restante ?? 0
  return +(base - debtsStore.totalPendienteEsteMes).toFixed(2)
})

// ── Acciones rápidas desde el dashboard ──────────────────────────────────────
const navigating = ref(false)

async function quickOpen(type: 'income' | 'transaction') {
  if (!store.dashboard) return
  navigating.value = true
  try {
    await budgetStore.fetchAll()
    const { anio, mes: mesNombre } = store.dashboard.mesActual
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const month = MESES.indexOf(mesNombre) + 1
    const budget = budgetStore.budgets.find(b => b.year === anio && b.month === month)
    if (budget) {
      router.push({ name: 'BudgetDetail', params: { id: budget.id }, query: { open: type } })
    }
  } finally {
    navigating.value = false
  }
}

// ── Selector de año para la gráfica ───────────────────────────────────────
const selectedYear = ref(new Date().getFullYear())

function changeYear(delta: number) {
  selectedYear.value += delta
  store.fetchAnnual(selectedYear.value)
}

// ── Carga al montar ────────────────────────────────────────────────────────
onMounted(async () => {
  // Paralelizamos: dashboard, anual y deudas (para los pagos pendientes del mes).
  // Las tres fuentes son independientes, no tiene sentido esperarlas en serie.
  await Promise.all([
    store.fetchDashboard(),
    store.fetchAnnual(selectedYear.value),
    debtsStore.fetchAll(),
  ])
})

// Recarga los datos anuales si cambia el año
watch(selectedYear, (y) => store.fetchAnnual(y))

// ── Helpers de formato ─────────────────────────────────────────────────────
function fmt(val: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(val)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { year: 'numeric', month: 'short' })
}

function formatCategory(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')
}

// ── Clase dinámica de la tarjeta de gasto ─────────────────────────────────
const spentClass = computed(() => {
  const p = store.spentPercent
  if (p >= 90) return 'metric-card--red'
  if (p >= 70) return 'metric-card--orange'
  return 'metric-card--blue'
})

// ── Exportación a Excel ────────────────────────────────────────────────────
// Toda la generación pasa en el frontend: los stores tienen los datos ya
// descifrados en memoria y armamos las estructuras planas que consume el
// util. Cada `fetchOne` muta el store, así que snapshoteamos los campos
// relevantes en el mismo turno de loop antes de avanzar al siguiente mes.
const exporting = ref(false)

const FREQ_LABEL: Record<string, string> = {
  mensual:   'Mensual',
  quincenal: 'Quincenal',
  semanal:   'Semanal',
  unico:     'Único',
}
const METHOD_LABEL: Record<string, string> = {
  snowball:  'Bola de nieve',
  avalanche: 'Avalancha',
  fireball:  'Fireball',
  snowflake: 'Snowflake',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Activa',
  paused: 'Pausada',
  paid:   'Liquidada',
}

async function downloadReport() {
  if (exporting.value) return
  exporting.value = true
  try {
    // ── 1. Budgets del año ──────────────────────────────────────────────
    await budgetStore.fetchAll()
    const yearBudgets = budgetStore.budgets.filter(b => b.year === selectedYear.value)
    const exportBudgets: ExportBudget[] = []

    for (const b of yearBudgets) {
      try {
        await budgetStore.fetchOne(b.id)
      } catch (e) {
        console.warn(`[downloadReport] Budget ${b.id} no se pudo descifrar — se omite del reporte`, e)
        continue
      }
      // Si por alguna razón el summary aún no se computó (estado degradado de
      // crypto, fetchOne abortado a medias) usamos zeros — el resto del
      // presupuesto se sigue exportando con la mejor data disponible.
      const summary = budgetStore.summary
      const reglaZero = { limite: 0, actual: 0 }
      const regla = summary
        ? {
            necesidades: { limite: summary.regla.necesidades.limite, actual: summary.regla.necesidades.actual },
            deseos:      { limite: summary.regla.deseos.limite,      actual: summary.regla.deseos.actual      },
            ahorro:      { limite: summary.regla.ahorro.limite,      actual: summary.regla.ahorro.actual      },
          }
        : { necesidades: { ...reglaZero }, deseos: { ...reglaZero }, ahorro: { ...reglaZero } }

      exportBudgets.push({
        year:                          b.year,
        month:                         b.month,
        totalIngresoReal:              budgetStore.incomes.reduce((s, i) => s + i.actual, 0),
        totalIngresoBudgeted:          budgetStore.totalIngresos,
        totalFacturasReal:             budgetStore.totalFacturas,
        totalFacturasBudgeted:         budgetStore.totalGastosFijos,
        totalGastosVariablesReal:      budgetStore.totalTransacciones,
        totalGastosVariablesBudgeted:  budgetStore.totalGastosVariables,
        disponible:                    budgetStore.disponible,
        pagoDeudasMin:                 0,   // se setea más abajo (depende de la suma global)
        regla,
        incomes: budgetStore.incomes.map(i => ({
          name: i.name, budgeted: i.budgeted, actual: i.actual,
        })),
        bills: budgetStore.bills.map(bi => ({
          name:        bi.name,
          budgeted:    bi.budgeted,
          actual:      bi.actual,
          dueDate:     bi.dueDate,
          paymentType: bi.paymentType,
          isPaid:      bi.isPaid,
        })),
        // expensesWithActuals recalcula `actual` desde transactions — más fiel
        // que el campo persistido en la entidad.
        expenses: budgetStore.expensesWithActuals.map(e => ({
          category: formatCategory(e.category),
          budgeted: e.budgeted,
          actual:   e.actual,
        })),
        transactions: budgetStore.transactions.map(t => ({
          date:        t.date,
          category:    formatCategory(t.category),
          note:        t.note,
          paymentType: t.paymentType,
          amount:      t.amount,
        })),
      })
    }

    // ── 2. Deudas + amortización por deuda ──────────────────────────────
    await debtsStore.fetchAll()
    const exportDebts: ExportDebt[] = []
    for (const d of debtsStore.debts) {
      let amort: ExportAmortizationRow[] = []
      try {
        await debtsStore.fetchAmortization(d.id)
        const today = new Date()
        amort = debtsStore.amortization.map((r) => {
          // El backend devuelve solo `mes #`. Calculamos la fecha estimada
          // como hoy + N meses para que el reporte tenga la columna FECHA.
          const fecha = new Date(today)
          fecha.setMonth(fecha.getMonth() + r.mes)
          return {
            mes:           r.mes,
            fechaEstimada: fecha.toISOString().split('T')[0],
            pagoEsperado:  r.pagoEsperado,
            capital:       r.capital,
            interes:       r.interes,
            iva:           r.iva,
            saldoRestante: r.saldoRestante,
          }
        })
      } catch (e) {
        // Una deuda liquidada o pausada puede no tener amortización proyectada;
        // ignoramos el error y dejamos la tabla vacía para esa deuda.
        console.warn(`[downloadReport] Amortización ${d.id} omitida`, e)
      }
      const capitalAmort = +(d.initialAmount - d.remainingBalance).toFixed(2)
      const pct          = d.initialAmount > 0 ? (capitalAmort / d.initialAmount) * 100 : 0

      exportDebts.push({
        id:                 d.id,
        name:               d.name,
        initialAmount:      d.initialAmount,
        remainingBalance:   d.remainingBalance,
        capitalAmortizado:  Math.max(0, capitalAmort),
        porcentajeAvance:   Math.max(0, +pct.toFixed(1)),
        minimumPayment:     d.minimumPayment,
        annualInterestRate: d.annualInterestRate,
        rateType:           d.rateType,
        ivaRate:            d.ivaRate ?? 0,
        method:             METHOD_LABEL[d.method] ?? d.method,
        status:             STATUS_LABEL[d.status] ?? d.status,
        amortization:       amort,
      })
    }

    // Pago mensual a deudas = suma de mínimos de las deudas activas. Mismo
    // valor para todos los meses del año (no varía con cada budget). Number()
    // explícito porque TypeORM serializa los DECIMAL como string — sin la
    // coerción, el reduce daría string concat (ej. "02965.471072.01") en
    // lugar de la suma. Mismo patrón que usa debts.store:76.
    const activeMin = debtsStore.activeDebts.reduce(
      (s, d) => s + (Number(d.minimumPayment) || 0),
      0,
    )
    exportBudgets.forEach(b => { b.pagoDeudasMin = activeMin })

    // ── 3. Metas de ahorro + historial de contribuciones ────────────────
    // /savings (fetchAll) trae toda la info para calcular el progreso —
    // currentAmount/targetAmount basta, no hace falta /progress. Para el
    // historial sí pegamos un fetch por meta a /savings/:id/records (vía
    // savingsStore.fetchOne, que ahora consulta la URL correcta).
    await savingsStore.fetchAll()
    const exportSavings: ExportSavingGoal[] = []
    for (const g of savingsStore.goals) {
      let contribs: ExportSavingContribution[] = []
      try {
        await savingsStore.fetchOne(g.id)
        contribs = savingsStore.contributions.map(c => ({
          date: c.date, amount: c.amount, note: c.note,
        }))
      } catch (e) {
        console.warn(`[downloadReport] Contribuciones ${g.id} omitidas`, e)
      }
      const proj     = computeGoalProjection(g)
      const restante = +(g.targetAmount - g.currentAmount).toFixed(2)
      const pct      = g.targetAmount > 0 ? (g.currentAmount / g.targetAmount) * 100 : 100

      exportSavings.push({
        id:                    g.id,
        name:                  g.name,
        targetAmount:          g.targetAmount,
        currentAmount:         g.currentAmount,
        restante:              Math.max(0, restante),
        porcentaje:            Math.min(100, +pct.toFixed(1)),
        frecuencia:            FREQ_LABEL[g.frequency] ?? g.frequency,
        aportePorPeriodo:      g.minimumMonthlyContribution,
        aporteMensualEfectivo: proj.aporteMensualEfectivo,
        mesesRestantes:        proj.mesesRestantes,
        fechaEstimada:         proj.fechaEstimada,
        esAporteUnico:         proj.esAporteUnico,
        isCompleted:           g.isCompleted,
        contributions:         contribs,
      })
    }

    // ── 4. Generar el workbook y disparar la descarga ───────────────────
    await exportFinancialReport({
      year:    selectedYear.value,
      budgets: exportBudgets,
      debts:   exportDebts,
      savings: exportSavings,
    })
  } catch (e) {
    console.error('[downloadReport] Error generando el reporte', e)
    alert('No se pudo generar el reporte. Revisa la consola para más detalles.')
  } finally {
    exporting.value = false
  }
}

// ── Altura proporcional de barra ──────────────────────────────────────────
function barHeight(val: number): string {
  if (!store.annual) return '0px'
  const allValues = store.annual.meses.flatMap(m => [m.ingreso ?? 0, m.gastado ?? 0])
  const max = Math.max(...allValues, 1)
  return Math.max(4, (val / max) * 120) + 'px'
}

// ── Tooltip hover de la gráfica anual ─────────────────────────────────────
// Único tooltip flotante anclado al contenedor de la gráfica. Lo posicionamos
// por % de columna en vez de seguir al cursor — el resultado se siente más
// estable cuando el usuario hace barrido horizontal entre meses adyacentes.
interface ChartMonth {
  numero:   number
  mes:      string
  ingreso?: number | null
  gastado?: number | null
}

const hoveredMonth = ref<ChartMonth | null>(null)
const hoveredIndex = ref(-1)

function onColEnter(mes: ChartMonth, idx: number) {
  hoveredMonth.value = mes
  hoveredIndex.value = idx
}

function onChartLeave() {
  hoveredMonth.value = null
  hoveredIndex.value = -1
}

// Posición horizontal: % del centro de la columna activa dentro del flex.
// Las 12 columnas comparten ancho, así que (idx + 0.5) / 12 da el centro.
// El translate(-50%, -100%) que centra y eleva el tooltip vive en el CSS
// base — acá solo setamos `left` para que la animación de entrada (que
// también usa transform) no entre en conflicto con un valor inline.
const tooltipStyle = computed(() => {
  if (hoveredIndex.value === -1) return {}
  const xPct = ((hoveredIndex.value + 0.5) / 12) * 100
  return { left: `${xPct}%` }
})

// Balance del mes hovereado — coerción defensiva por si los valores
// llegan como string desde el endpoint anual (mismo problema TypeORM).
const hoveredBalance = computed(() => {
  if (!hoveredMonth.value) return 0
  const ing = Number(hoveredMonth.value.ingreso ?? 0) || 0
  const gas = Number(hoveredMonth.value.gastado ?? 0) || 0
  return +(ing - gas).toFixed(2)
})
</script>

<style scoped>
/* ── Layout general ────────────────────────────────────────── */
.dash {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

/* ── Loading / Error ───────────────────────────────────────── */
.dash__loading,
.dash__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  min-height: 300px;
  color: var(--color-text-muted);
}
.dash__spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Sub-header ────────────────────────────────────────────── */
.dash__subheader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.dash__period { display: flex; flex-direction: column; gap: 2px; }
.dash__period-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-muted); }
.dash__period-value { font-size: 18px; font-weight: 700; color: var(--color-text); }
.dash__quick-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.dash__year-selector { display: flex; align-items: center; gap: 12px; }
.dash__year { font-size: 16px; font-weight: 700; color: var(--color-text); min-width: 48px; text-align: center; }

/* ── Banner sin presupuesto ────────────────────────────────── */
.dash__empty-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  padding: 16px 20px;
  flex-wrap: wrap;
}
.dash__empty-banner__icon { font-size: 28px; flex-shrink: 0; }
.dash__empty-banner strong { display: block; color: var(--color-text); font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.dash__empty-banner p { font-size: 13px; color: var(--color-text-muted); }

/* ── Fila de métricas ──────────────────────────────────────── */
.dash__metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-md);
}

/* Tarjeta métrica base */
.metric-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 3px solid var(--color-border);
  transition: box-shadow var(--transition), transform var(--transition);
}
.metric-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); }
.metric-card--blue   { border-top-color: var(--color-primary); }
.metric-card--green  { border-top-color: var(--color-success); }
.metric-card--red    { border-top-color: var(--color-danger); }
.metric-card--orange { border-top-color: var(--color-warning); }

.metric-card__header { display: flex; align-items: center; justify-content: space-between; }
.metric-card__label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: .5px; }
.metric-card__icon { font-size: 18px; }
.metric-card__value { font-size: 26px; font-weight: 800; color: var(--color-text); letter-spacing: -1px; }
.metric-card__sub { font-size: 12px; color: var(--color-text-muted); }

/* Chip amarillo que muestra pagos mínimos de deudas pendientes del mes.
   Solo aparece en la card "Disponible real" cuando totalPendienteEsteMes > 0.
   Clickable — lleva al usuario a /debts para que registre los pagos. */
.metric-card__chip {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 10px;
  padding: 8px 10px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.35);
  border-radius: 8px;
  color: #b45309;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background .15s, transform .1s;
}
.metric-card__chip:hover {
  background: rgba(234, 179, 8, 0.2);
  transform: translateX(2px);
}
.metric-card__chip-icon { font-size: 14px; flex-shrink: 0; }
.metric-card__chip-text { flex: 1; line-height: 1.3; }
.metric-card__chip-arrow { font-weight: 700; flex-shrink: 0; }

/* Barra de progreso dentro de la tarjeta */
.metric-card__progress-wrap { display: flex; align-items: center; gap: 8px; }
.metric-card__progress {
  flex: 1;
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}
.metric-card__progress-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--color-primary);
  transition: width .6s ease;
}
.metric-card--red .metric-card__progress-fill    { background: var(--color-danger); }
.metric-card--orange .metric-card__progress-fill { background: var(--color-warning); }
.metric-card__pct { font-size: 12px; font-weight: 700; color: var(--color-text-muted); white-space: nowrap; }

/* ── Fila 2 ────────────────────────────────────────────────── */
.dash__row2 {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: var(--spacing-md);
  align-items: start;
}

/* Card base */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.card__title { font-size: 15px; font-weight: 700; color: var(--color-text); }
.card__link  { font-size: 13px; color: var(--color-primary); font-weight: 600; }
.card__link:hover { text-decoration: underline; }

/* ── Gráfica de barras ─────────────────────────────────────── */
.dash__chart-legend { display: flex; align-items: center; gap: 12px; font-size: 12px; color: var(--color-text-muted); }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; }
.dot--blue { background: var(--color-primary); }
.dot--red  { background: var(--color-danger); }

.dash__chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 140px;
  padding-bottom: 24px;
  position: relative; /* anchor del tooltip flotante */
}
.dash__chart-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  height: 100%;
  justify-content: flex-end;
}
.dash__chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  flex: 1;
  width: 100%;
  justify-content: center;
}
.dash__bar {
  width: 45%;
  border-radius: 3px 3px 0 0;
  transition: height .6s ease;
  min-height: 3px;
}
.dash__bar--blue { background: var(--color-primary); opacity: .85; }
.dash__bar--red  { background: var(--color-danger);  opacity: .75; }
.dash__bar--skeleton { background: var(--color-border); animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: .4; } 50% { opacity: .8; } }

.dash__chart-label {
  font-size: 10px;
  color: var(--color-text-muted);
  text-align: center;
}
.dash__chart-label--skeleton {
  width: 20px; height: 10px;
  background: var(--color-border);
  border-radius: 3px;
}

.dash__chart-totals {
  display: flex;
  gap: 20px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}
.dash__chart-totals strong { color: var(--color-text); }

/* ── Tooltip flotante de la gráfica anual ────────────────────
   Se posiciona en la parte superior del contenedor; left se setea
   inline con el % calculado por columna activa. pointer-events:none
   para que no robe hover al mover el cursor entre meses. */
.dash__chart-tooltip {
  position: absolute;
  top: 0;
  margin-top: -10px;       /* respiro entre top de barras y tooltip */
  /* translate(-50%, -100%) = centra horizontal sobre la columna + eleva por
     completo encima del contenedor. left se inyecta por :style según el mes. */
  transform: translate(-50%, -100%);
  background: #1F2937;     /* slate oscuro, alto contraste con todas las barras */
  color: #F8FAFC;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.78rem;
  line-height: 1.4;
  white-space: nowrap;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  z-index: 10;
  min-width: 170px;
  animation: tooltip-fade-in 0.12s ease-out;
}
.dash__chart-tooltip__title {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94A3B8;
  margin-bottom: 6px;
}
.dash__chart-tooltip__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-variant-numeric: tabular-nums;
}
.dash__chart-tooltip__row + .dash__chart-tooltip__row { margin-top: 3px; }
.dash__chart-tooltip__row .dot { flex-shrink: 0; width: 8px; height: 8px; }
.dash__chart-tooltip__label { flex: 1; color: #CBD5E1; font-weight: 400; }
.dash__chart-tooltip__row strong { font-weight: 600; color: #FFFFFF; }
.dash__chart-tooltip__balance {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.dash__chart-tooltip__balance.is-positive strong { color: #10B981; } /* verde */
.dash__chart-tooltip__balance.is-negative strong { color: #F87171; } /* rojo claro */

@keyframes tooltip-fade-in {
  from { opacity: 0; transform: translate(-50%, -95%); }
  to   { opacity: 1; transform: translate(-50%, -100%); }
}

/* ── Panel deudas ──────────────────────────────────────────── */
.debt-progress { display: flex; flex-direction: column; gap: 6px; }
.debt-progress__bar {
  height: 10px;
  background: var(--color-border);
  border-radius: 5px;
  overflow: hidden;
}
.debt-progress__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-success));
  border-radius: 5px;
  transition: width .8s ease;
}
.debt-progress__labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--color-text-muted);
}

.debt-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.debt-stat { display: flex; flex-direction: column; gap: 2px; }
.debt-stat__label { font-size: 11px; color: var(--color-text-muted); }
.debt-stat__value { font-size: 15px; font-weight: 700; color: var(--color-text); }

.debt-chips { display: flex; gap: 8px; flex-wrap: wrap; }

/* ── Fila 3 ────────────────────────────────────────────────── */
.dash__row3 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  align-items: start;
}

/* ── Top categorías ────────────────────────────────────────── */
.top-list { display: flex; flex-direction: column; gap: 12px; }
.top-item {
  display: grid;
  grid-template-columns: 24px 1fr 120px 80px;
  align-items: center;
  gap: 10px;
}
.top-item__pos {
  font-size: 12px;
  font-weight: 800;
  color: var(--color-text-muted);
  text-align: center;
}
.top-item__info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.top-item__name { font-size: 13px; font-weight: 600; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* .top-item__type ahora es AppBadge — estilos eliminados */

.top-item__bar-wrap { display: flex; align-items: center; gap: 6px; }
.top-item__bar {
  flex: 1;
  height: 6px;
  background: var(--color-border);
  border-radius: 3px;
  overflow: hidden;
}
.top-item__fill { height: 100%; border-radius: 3px; transition: width .6s ease; }
.top-item__pct  { font-size: 11px; color: var(--color-text-muted); white-space: nowrap; }
.top-item__amount { font-size: 13px; font-weight: 700; color: var(--color-text); text-align: right; }

/* ── Anillo de ahorros ─────────────────────────────────────── */
.savings-global { display: flex; gap: 20px; align-items: center; }
.savings-global__ring { width: 90px; flex-shrink: 0; }

.savings-ring { width: 90px; height: 90px; transform: rotate(-90deg); }
.savings-ring__bg   { fill: none; stroke: var(--color-border); stroke-width: 3.5; }
.savings-ring__fill {
  fill: none;
  stroke: var(--color-success);
  stroke-width: 3.5;
  stroke-linecap: round;
  transition: stroke-dasharray .8s ease;
}
.savings-ring__text {
  fill: var(--color-text);
  font-size: 7px;
  font-weight: 700;
  text-anchor: middle;
  transform: rotate(90deg);
  transform-origin: center;
}

.savings-global__stats { display: flex; flex-direction: column; gap: 10px; flex: 1; }
.savings-stat { display: flex; flex-direction: column; gap: 1px; }
.savings-stat__label { font-size: 11px; color: var(--color-text-muted); }
.savings-stat__value { font-size: 15px; font-weight: 700; color: var(--color-text); }

.savings-next {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.savings-next__header { display: flex; align-items: center; justify-content: space-between; }
.savings-next__label  { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: var(--color-text-muted); font-weight: 600; }
.savings-next__name   { font-size: 14px; font-weight: 700; color: var(--color-text); }
.savings-next__bar {
  height: 7px;
  background: var(--color-border);
  border-radius: 4px;
  overflow: hidden;
}
.savings-next__fill {
  height: 100%;
  background: var(--color-success);
  border-radius: 4px;
  transition: width .8s ease;
}
.savings-next__faltante { font-size: 12px; color: var(--color-text-muted); }

.savings-emergency {
  background: var(--color-info-light);
  border: 1px solid var(--color-info);
  border-radius: var(--radius-md);
  padding: 12px;
}
.savings-emergency__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

/* Los chips/badges son ahora átomo AppBadge — estilos eliminados */

/* ── Sin datos ─────────────────────────────────────────────── */
.dash__no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}
.dash__no-data span { font-size: 28px; }

/* ── Colores de texto helpers ──────────────────────────────── */
.text-green  { color: var(--color-success) !important; }
.text-red    { color: var(--color-danger)  !important; }
.text-blue   { color: var(--color-primary) !important; }
.text-orange { color: var(--color-warning) !important; }

/* Los botones son ahora átomo AppButton — estilos eliminados */

/* ── Responsive ────────────────────────────────────────────── */
@media (max-width: 1200px) {
  .dash__metrics { grid-template-columns: repeat(2, 1fr); }
  .dash__row2    { grid-template-columns: 1fr; }
  .dash__debt-card { max-width: 100%; }
}

@media (max-width: 768px) {
  .dash__metrics  { grid-template-columns: 1fr 1fr; }
  .dash__row3     { grid-template-columns: 1fr; }
  .top-item       { grid-template-columns: 24px 1fr 60px; }
  .top-item__bar-wrap { display: none; }
}

@media (max-width: 480px) {
  .dash__metrics { grid-template-columns: 1fr; }
  .metric-card__value { font-size: 22px; }
}
</style>
