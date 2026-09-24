export type PaymentType = 'efectivo' | 'tarjeta' | 'transferencia' | 'debito' | 'otro'

// Ahora es string libre — el key viene de ExpenseCategoryEntity (global o personalizada)
export type ExpenseCategory = string

// ── Payload cifrado (shape que viaja al/del servidor) ─────────────────────
/** Payload cifrado almacenado en el servidor */
export interface EncryptedField {
  iv: string
  ct: string
}

// ── Budget (sin campos monetarios directos) ───────────────────────────────
export interface Budget {
  id:          string
  year:        number
  month:       number
  /**
   * Total de ingresos del mes en valores ya descifrados.
   *
   * E2EE: el backend mantiene esta columna en 0 (no puede sumar montos
   * cifrados). El cliente la sintetiza descifrando los `incomes` cifrados
   * que vienen embebidos en /budgets, y la deja lista para consumo en la UI.
   */
  totalIncome: number
  createdAt:   string
}

// ── Incomes ───────────────────────────────────────────────────────────────

/** Income descifrado para uso local */
export interface Income {
  id:        string
  name:      string
  budgeted:  number
  actual:    number
  budgetId:  string
  createdAt: string
}

/** Income tal como llega/va al servidor (campos monetarios cifrados) */
export interface IncomeEncrypted {
  id:        string
  name:      string
  budgeted:  EncryptedField
  actual:    EncryptedField | null
  budgetId:  string
  createdAt: string
}

// ── Bills ─────────────────────────────────────────────────────────────────

/** Bill descifrado para uso local */
export interface Bill {
  id:          string
  name:        string
  budgeted:    number
  actual:      number
  paymentType: PaymentType | null
  dueDate:     string | null
  isPaid:      boolean
  budgetId:    string
  createdAt:   string
}

/** Bill tal como llega/va al servidor (campos monetarios cifrados) */
export interface BillEncrypted {
  id:          string
  name:        string
  budgeted:    EncryptedField
  actual:      EncryptedField | null
  paymentType: PaymentType | null
  dueDate:     string | null
  isPaid:      boolean
  budgetId:    string
  createdAt:   string
}

// ── Expenses ──────────────────────────────────────────────────────────────

/** Expense descifrado para uso local */
export interface Expense {
  id:          string
  category:    ExpenseCategory
  budgeted:    number
  actual:      number
  paymentType: PaymentType | null
  budgetId:    string
  createdAt:   string
}

/** Expense tal como llega/va al servidor (campos monetarios cifrados) */
export interface ExpenseEncrypted {
  id:          string
  category:    ExpenseCategory
  budgeted:    EncryptedField
  actual:      EncryptedField | null
  paymentType: PaymentType | null
  budgetId:    string
  createdAt:   string
}

// ── Transactions ──────────────────────────────────────────────────────────

/** Transaction descifrada para uso local */
export interface Transaction {
  id:          string
  amount:      number
  category:    ExpenseCategory
  paymentType: PaymentType | null
  note:        string | null
  date:        string
  budgetId:    string
  createdAt:   string
}

/** Transaction tal como llega/va al servidor (campo monetario cifrado) */
export interface TransactionEncrypted {
  id:          string
  amount:      EncryptedField
  category:    ExpenseCategory
  paymentType: PaymentType | null
  note:        string | null
  date:        string
  budgetId:    string
  createdAt:   string
}

// ── Budget Full (servidor devuelve entidades cifradas) ─────────────────────

/** Presupuesto completo con relaciones cifradas tal como llega del servidor */
export interface BudgetFullEncrypted extends Budget {
  incomes:      IncomeEncrypted[]
  bills:        BillEncrypted[]
  expenses:     ExpenseEncrypted[]
  transactions: TransactionEncrypted[]
}

/**
 * Shape de la respuesta de /budgets (lista). Incluye los ingresos cifrados
 * embebidos para que el cliente pueda descifrar y sintetizar el `totalIncome`
 * de cada mes — el backend no puede hacerlo bajo E2EE.
 */
export interface BudgetListItem extends Budget {
  incomes: IncomeEncrypted[]
}

/** Presupuesto completo con relaciones descifradas para uso local */
export interface BudgetFull extends Budget {
  incomes:      Income[]
  bills:        Bill[]
  expenses:     Expense[]
  transactions: Transaction[]
}

// ── Resumen financiero (calculado localmente) ─────────────────────────────

/** Resumen financiero calculado localmente */
export interface BudgetSummary {
  totalIngresos:       number
  totalFacturas:       number
  totalGastosFijos:    number
  totalGastosVariables: number
  totalGastado:        number
  disponible:          number
  regla: {
    necesidades: { limite: number; actual: number; porcentaje: number }
    deseos:      { limite: number; actual: number; porcentaje: number }
    ahorro:      { limite: number; actual: number; porcentaje: number }
  }
}
