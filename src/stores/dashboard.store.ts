// Store del dashboard — descifra datos E2EE y calcula agregaciones localmente
import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'

// ── Constantes de mensajes E2EE ────────────────────────────────────────────────
const MSG_CRYPTO_READ_BLOCKED = 'Tus datos están protegidos. Desbloqueá tu cifrado para visualizarlos.'
import { useCryptoStore } from '@/stores/crypto.store'
import DashboardService from '@/services/dashboard.service'
import type {
  FullDashboard, AnnualSummary, MonthOverview, TopGastos,
  RawDashboardResponse, RawAnnualResponse,
} from '@/services/dashboard.service'
import type {
  IncomeEncrypted, BillEncrypted, TransactionEncrypted,
  BudgetFullEncrypted,
} from '@/types/budget.types'

// Nombres de meses para el resumen anual
const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// ── Helpers de descifrado ──────────────────────────────────────────────────

async function decryptNumber(field: { iv: string; ct: string } | null): Promise<number> {
  if (!field) return 0
  const crypto = useCryptoStore()
  return crypto.decrypt<number>(field)
}

async function sumEncryptedIncomes(incomes: IncomeEncrypted[]): Promise<number> {
  const values = await Promise.all(incomes.map(i => decryptNumber(i.actual ?? i.budgeted)))
  return values.reduce((s, v) => s + v, 0)
}

async function sumEncryptedBillActuals(bills: BillEncrypted[]): Promise<number> {
  const values = await Promise.all(bills.map(b => decryptNumber(b.actual)))
  return values.reduce((s, v) => s + v, 0)
}

async function sumEncryptedTransactions(txs: TransactionEncrypted[]): Promise<number> {
  const values = await Promise.all(txs.map(t => decryptNumber(t.amount)))
  return values.reduce((s, v) => s + v, 0)
}

/** Construye el MonthOverview descifrado a partir del budget crudo */
async function buildMonthOverview(
  mes: string,
  anio: number,
  budget: BudgetFullEncrypted | null | undefined,
  mensaje?: string,
): Promise<MonthOverview> {
  if (!budget) {
    return { mes, anio, mensaje: mensaje ?? 'No existe presupuesto para el mes actual.' }
  }

  const totalIngreso  = await sumEncryptedIncomes(budget.incomes)
  const totalFacturas = await sumEncryptedBillActuals(budget.bills)
  const totalTx       = await sumEncryptedTransactions(budget.transactions)
  const totalGastado  = totalFacturas + totalTx

  return {
    mes,
    anio,
    totalIngreso: +totalIngreso.toFixed(2),
    totalGastado: +totalGastado.toFixed(2),
    restante:     +(totalIngreso - totalGastado).toFixed(2),
    facturas:     +totalFacturas.toFixed(2),
    gastos:       +totalTx.toFixed(2),
  }
}

/** Construye el top 5 de categorías de gasto descifradas */
async function buildTopGastos(
  anio: number,
  txs: TransactionEncrypted[],
): Promise<TopGastos> {
  // Descifrar todos los montos
  const decrypted = await Promise.all(
    txs.map(async (tx) => ({
      category: tx.category,
      amount:   await decryptNumber(tx.amount),
    })),
  )

  // Agrupar por categoría
  const grouped = new Map<string, { total: number; count: number }>()
  for (const { category, amount } of decrypted) {
    const entry = grouped.get(category) ?? { total: 0, count: 0 }
    entry.total += amount
    entry.count++
    grouped.set(category, entry)
  }

  // Ordenar por total desc, top 5
  const sorted = [...grouped.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5)

  const sumaTotal = sorted.reduce((s, [, v]) => s + v.total, 0)

  return {
    anio,
    top5: sorted.map(([categoria, v], i) => ({
      posicion:      i + 1,
      categoria,
      tipo:          'deseo', // sin CATEGORY_TYPE en el frontend por ahora
      total:         +v.total.toFixed(2),
      transacciones: v.count,
      porcentaje:    sumaTotal ? +((v.total / sumaTotal) * 100).toFixed(1) : 0,
    })),
    totalGastado: +sumaTotal.toFixed(2),
  }
}

/** Construye el resumen anual descifrado */
async function buildAnnualSummary(
  anio: number,
  budgets: BudgetFullEncrypted[],
): Promise<AnnualSummary> {
  const meses = await Promise.all(
    MESES.map(async (nombre, i) => {
      const mes = i + 1
      const budget = budgets.find((b) => b.month === mes)

      if (!budget) {
        return { mes: nombre, numero: mes, sinDatos: true }
      }

      const ingreso  = await sumEncryptedIncomes(budget.incomes)
      const facturas = await sumEncryptedBillActuals(budget.bills)
      const gastos   = await sumEncryptedTransactions(budget.transactions)
      const gastado  = facturas + gastos

      return {
        mes:      nombre,
        numero:   mes,
        sinDatos: false,
        ingreso:  +ingreso.toFixed(2),
        gastado:  +gastado.toFixed(2),
        balance:  +(ingreso - gastado).toFixed(2),
      }
    }),
  )

  const conDatos = meses.filter((m) => !m.sinDatos) as { ingreso: number; gastado: number; balance: number }[]
  const totalIngreso = conDatos.reduce((s, m) => s + m.ingreso, 0)
  const totalGastado = conDatos.reduce((s, m) => s + m.gastado, 0)

  return {
    anio,
    meses,
    totales: {
      ingreso: +totalIngreso.toFixed(2),
      gastado: +totalGastado.toFixed(2),
      balance: +(totalIngreso - totalGastado).toFixed(2),
    },
    mesesRegistrados: conDatos.length,
  }
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useDashboardStore = defineStore('dashboard', () => {
  const dashboard  = ref<FullDashboard | null>(null)
  const annual     = ref<AnnualSummary | null>(null)
  const loading    = ref(false)
  const error      = ref<string | null>(null)
  const lastFetch  = ref<Date | null>(null)
  const degraded   = ref(false)

  const hasBudget = computed(
    () => dashboard.value !== null && !dashboard.value.mesActual.mensaje,
  )

  const spentPercent = computed(() => {
    const m = dashboard.value?.mesActual
    if (!m || !m.totalIngreso) return 0
    return Math.min(100, +((m.totalGastado! / m.totalIngreso) * 100).toFixed(1))
  })

  /** Carga el dashboard, descifra y calcula todos los totales localmente */
  async function fetchDashboard() {
    const cryptoStore = useCryptoStore()
    if (!cryptoStore.isReady) {
      degraded.value = true
      error.value    = MSG_CRYPTO_READ_BLOCKED
      return
    }

    loading.value = true
    error.value   = null
    try {
      const raw: RawDashboardResponse = await DashboardService.getFullDashboard()

      // Descifrar y calcular en paralelo
      const [mesActual, topGastos, anualData] = await Promise.all([
        buildMonthOverview(
          raw.mesActual.mes,
          raw.mesActual.anio,
          raw.mesActual.budget,
          raw.mesActual.mensaje,
        ),
        buildTopGastos(raw.topGastos.anio, raw.topGastos.transactions),
        buildAnnualSummary(raw.anual.anio, raw.anual.budgets),
      ])

      dashboard.value = {
        generadoEn: raw.generadoEn,
        mesActual,
        anual: {
          anio:             anualData.anio,
          totales:          anualData.totales,
          mesesRegistrados: anualData.mesesRegistrados,
        },
        deudas:    raw.deudas,
        ahorros:   raw.ahorros,
        topGastos,
      }

      // Guardar anual para la gráfica de barras
      annual.value    = anualData
      lastFetch.value = new Date()
      degraded.value  = false
    } catch (e: unknown) {
      degraded.value = true
      error.value    = _extractError(e)
    } finally {
      loading.value = false
    }
  }

  /** Carga el resumen anual para un año específico */
  async function fetchAnnual(year: number) {
    const cryptoStore = useCryptoStore()
    if (!cryptoStore.isReady) {
      degraded.value = true
      error.value    = MSG_CRYPTO_READ_BLOCKED
      return
    }

    try {
      const raw: RawAnnualResponse = await DashboardService.getAnnualSummary(year)
      annual.value   = await buildAnnualSummary(raw.anio, raw.budgets)
      degraded.value = false
    } catch (e: unknown) {
      degraded.value = true
      error.value    = _extractError(e)
      console.warn(e)
    }
  }

  async function fetchIfStale() {
    const CINCO_MIN = 5 * 60 * 1000
    if (!lastFetch.value || Date.now() - lastFetch.value.getTime() > CINCO_MIN) {
      await fetchDashboard()
    }
  }

  function _extractError(e: unknown): string {
    if (e && typeof e === 'object' && 'response' in e) {
      const r = (e as { response?: { data?: { message?: string } } }).response
      return r?.data?.message ?? 'Error al cargar el dashboard'
    }
    return 'Error al cargar el dashboard'
  }

  return {
    dashboard,
    annual,
    loading,
    error,
    degraded: readonly(degraded),
    hasBudget,
    spentPercent,
    fetchDashboard,
    fetchAnnual,
    fetchIfStale,
  }
})
