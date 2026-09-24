// Servicio del dashboard — consume /api/v1/dashboard
import api from './api'
import type {
  BudgetFullEncrypted,
  TransactionEncrypted,
} from '@/types/budget.types'

// ── Tipos de respuesta del servidor (datos cifrados / no cifrados) ─────────

/** Respuesta cruda de /dashboard — campos monetarios cifrados como jsonb */
export interface RawDashboardResponse {
  generadoEn: string
  mesActual: {
    mes:     string
    anio:    number
    budget?: BudgetFullEncrypted | null
    mensaje?: string
  }
  anual: {
    anio:              number
    budgets:           BudgetFullEncrypted[]
    mesesRegistrados:  number
  }
  deudas:  DebtOverview
  ahorros: SavingsOverview
  topGastos: {
    anio:         number
    transactions: TransactionEncrypted[]
  }
}

/** Respuesta cruda de /dashboard/annual/:year */
export interface RawAnnualResponse {
  anio:              number
  budgets:           BudgetFullEncrypted[]
  mesesRegistrados:  number
}

// ── Tipos que NO cambian (entidades no cifradas) ──────────────────────────

export interface DebtOverview {
  totalDeudas:              number
  deudasActivas:            number
  deudasLiquidadas:         number
  totalInicial:             number
  totalRestante:            number
  totalPagado:              number
  porcentajeAvance:         number
  pagoMinimoMensual:        number
  mesesParaLibertad:        number | null
  fechaEstimadaLibertad:    string | null
}

export interface SavingsOverview {
  totalMetas:       number
  metasActivas:     number
  metasCompletadas: number
  totalObjetivo:    number
  totalAhorrado:    number
  totalFaltante:    number
  porcentajeGlobal: number
  fondoEmergencias: { nombre: string; objetivo: number; ahorrado: number; progreso: number } | null
  proximaMeta:      { nombre: string; progreso: number; faltante: number } | null
}

// ── Tipos públicos (post-descifrado, usados por la vista) ─────────────────

export interface MonthOverview {
  mes:          string
  anio:         number
  totalIngreso?: number
  totalGastado?: number
  restante?:    number
  facturas?:    number
  gastos?:      number
  mensaje?:     string
}

export interface TopGastos {
  anio:        number
  top5:        { posicion: number; categoria: string; tipo: string; total: number; transacciones: number; porcentaje: number }[]
  totalGastado: number
}

export interface AnnualSummary {
  anio:  number
  meses: {
    mes:      string
    numero:   number
    sinDatos: boolean
    ingreso?:  number
    gastado?:  number
    balance?:  number
  }[]
  totales:          { ingreso: number; gastado: number; balance: number }
  mesesRegistrados: number
}

export interface FullDashboard {
  generadoEn: string
  mesActual:  MonthOverview
  anual: {
    anio:              number
    totales:           { ingreso: number; gastado: number; balance: number }
    mesesRegistrados:  number
  }
  deudas:    DebtOverview
  ahorros:   SavingsOverview
  topGastos: TopGastos
}

// ── API calls ─────────────────────────────────────────────────────────────

const DashboardService = {
  async getFullDashboard(): Promise<RawDashboardResponse> {
    const { data } = await api.get<RawDashboardResponse>('/dashboard')
    return data
  },

  async getAnnualSummary(year: number): Promise<RawAnnualResponse> {
    const { data } = await api.get<RawAnnualResponse>(`/dashboard/annual/${year}`)
    return data
  },
}

export default DashboardService
