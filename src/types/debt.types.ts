export type DebtMethod   = 'snowball' | 'avalanche' | 'fireball' | 'snowflake'
export type DebtStatus   = 'active' | 'paid' | 'paused'
// Naturaleza de la tasa: fija (no cambia) o variable (referenciada a un índice
// externo tipo TIIE/IBR). El detalle muestra un banner cuando es 'variable'
// para advertir que las proyecciones pueden quedar desactualizadas.
export type DebtRateType = 'fixed' | 'variable'

// Payload de creación — espejo exacto de CreateDebtDto del backend
export interface CreateDebtPayload {
  name:                string
  initialAmount:       number
  remainingBalance?:   number   // Si se omite, el backend usa initialAmount
  minimumPayment:      number
  annualInterestRate?: number
  rateType?:           DebtRateType   // Si se omite, el backend usa 'fixed'
  startDate:           string
  method?:             DebtMethod
  status?:             DebtStatus
  priorityOrder?:      number
  notes?:              string | null
  cutoffDay?:          number | null
  paymentDueDay?:      number | null
  lateInterestRate?:   number | null
  // Productos de plazo fijo (FlexPlan / créditos a meses)
  plazo?:              number | null
  ivaRate?:            number | null
}

export interface Debt {
  id:                  string
  name:                string
  initialAmount:       number
  remainingBalance:    number
  minimumPayment:      number
  annualInterestRate:  number
  rateType:            DebtRateType
  // Sello de la última edición de annualInterestRate. Lo gestiona el backend
  // automáticamente desde updateDebt — el formulario NO lo manipula.
  // null hasta el primer cambio de tasa.
  rateLastUpdated:     string | null
  startDate:           string
  method:              DebtMethod
  status:              DebtStatus
  priorityOrder:       number
  notes:               string | null
  // Configuración de fechas de pago
  cutoffDay:           number | null
  paymentDueDay:       number | null
  lateInterestRate:    number | null
  // Productos de plazo fijo (FlexPlan / créditos a meses)
  plazo:               number | null
  ivaRate:             number | null
  // Campos computados por el backend en tiempo de consulta
  isOverdue:           boolean
  lateInterestAmount:  number
  /** true si existe al menos un DebtPayment en el mes calendario UTC actual.
   *  El dashboard lo usa para decidir si descontar el minimumPayment del
   *  "disponible real" o no (evita la doble contabilización cuando el pago
   *  ya se registró). */
  hasPaymentThisMonth?: boolean
  // Relación cargada en findAll/findOne — usada para sumar interestPaid global
  payments?:           DebtPayment[]
}

export interface DebtPayment {
  id:                  string
  debtId:              string
  paymentDate:         string
  expectedAmount:      number
  actualAmount:        number
  balanceAfterPayment: number
  interestPaid:        number
  capitalPaid:         number
  isPaid:              boolean
  note:                string | null
  /** Link 1:1 con la Transaction espejo del budget (Opción C). Poblado por el
   *  cliente tras crear la tx; el backend lo usa para cascade delete. */
  transactionId?:      string | null
}

export interface AmortizationRow {
  mes:           number
  pagoEsperado:  number
  /** Pago base sin IVA (igual a pagoEsperado en standard, igual a PMT en FlexPlan) */
  pagoSinIVA:    number
  interes:       number
  /** IVA sobre intereses — 0 en modo standard, calculado en FlexPlan */
  iva:           number
  capital:       number
  saldoRestante: number
  /** Pago total del mes incluyendo IVA. En standard = pagoEsperado. En FlexPlan = PMT + iva. */
  pagoTotal:     number
}

/** Respuesta completa del endpoint /debts/:id/amortization.
 *  Incluye la tabla proyectada + metadata para detectar el caso borde de
 *  amortización negativa (pago < interés del primer mes). */
export interface AmortizationData {
  deuda:                  string
  /** Modo del cálculo. 'flexplan' cuando hay plazo + ivaRate; 'standard' en otro caso. */
  mode:                   'standard' | 'flexplan'
  saldoActual:            number
  pagoEsperado:           number
  interesPrimerMes:       number
  mesesRestantes:         number
  totalIntereses:         number
  totalIVA:               number
  totalPagadoConIVA:      number
  /** true cuando el pago mínimo no cubre ni el interés mensual — la deuda
   *  NO se liquida con ese esquema. El cliente debe mostrar un banner
   *  de advertencia en vez de la tabla completa. */
  isNegativeAmortization: boolean
  tabla:                  AmortizationRow[]
}

export interface DebtPlanItem {
  prioridad:         number
  deuda:             string
  saldoRestante:     number
  pagoMensual:       number
  mesesParaLiquidar: number
  totalIntereses:    number
}

export interface DebtPlan {
  descripcion:            string
  mesesHastaLibertad:     number
  totalInteresesPagados:  number
  orden:                  DebtPlanItem[]
}
