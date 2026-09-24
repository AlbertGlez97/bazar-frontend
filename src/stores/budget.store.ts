// Store del modulo de presupuesto — orquesta cifrado E2EE y calculos locales
import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import BudgetService from '@/services/budget.service'
import { useCryptoStore } from '@/stores/crypto.store'
import { useToastStore } from '@/stores/toast.store'
import { useAuthStore } from '@/stores/auth.store'

// ── Mensajes de error E2EE — se muestran al usuario cuando el cifrado falla ──

/** Se muestra cuando el cifrado no está activo pero la clave puede restaurarse */
const MSG_CRYPTO_WRITE_BLOCKED = 'No podemos guardar: tu cifrado no está activo. Desbloqueá tu sesión o iniciá sesión de nuevo.'

/** Se muestra cuando no existe clave recuperable en este dispositivo — solo logout resuelve */
const MSG_CRYPTO_WRITE_UNRECOVERABLE = 'No podemos guardar: no hay clave recuperable en este dispositivo. Cerrá sesión e iniciá de nuevo.'

/** Se muestra cuando fetchOne no puede descifrar datos por falta de clave activa */
const MSG_CRYPTO_READ_BLOCKED = 'Tus datos están protegidos. Desbloqueá tu cifrado para visualizarlos.'
import {
  totalBudgetedIncome,
  totalActualBills,
  totalBudgetedBills,
  totalBudgetedExpenses,
  totalSpent,
  actualForExpense,
  calculateSummary,
} from '@/services/calculators'
import type {
  Budget, BudgetFull,
  Income, IncomeEncrypted,
  Bill, BillEncrypted,
  Expense, ExpenseEncrypted,
  Transaction, TransactionEncrypted,
  BudgetSummary, PaymentType, ExpenseCategory,
} from '@/types/budget.types'

// ── Helpers de descifrado ──────────────────────────────────────────────────

/**
 * AAD (Additional Authenticated Data) deshabilitado temporalmente.
 *
 * Para usar AAD, ambas partes (encrypt y decrypt) necesitan el mismo contexto:
 *   { entityId, budgetId, createdAt }
 * Pero al CREAR una entidad, el servidor asigna entityId y createdAt DESPUÉS
 * del cifrado — el frontend no los conoce al momento de cifrar.
 *
 * Solución futura: generar UUID client-side o usar flujo create → encrypt → update.
 * Por ahora ciframos y desciframos sin AAD. La DEK por usuario ya provee
 * aislamiento criptográfico suficiente.
 */

/** Descifra un Income del servidor */
async function decryptIncome(raw: IncomeEncrypted): Promise<Income> {
  const crypto = useCryptoStore()
  return {
    ...raw,
    budgeted: await crypto.decrypt<number>(raw.budgeted),
    actual: raw.actual ? await crypto.decrypt<number>(raw.actual) : 0,
  }
}

/** Descifra un Bill del servidor */
async function decryptBill(raw: BillEncrypted): Promise<Bill> {
  const crypto = useCryptoStore()
  return {
    ...raw,
    budgeted: await crypto.decrypt<number>(raw.budgeted),
    actual: raw.actual ? await crypto.decrypt<number>(raw.actual) : 0,
  }
}

/** Descifra un Expense del servidor */
async function decryptExpense(raw: ExpenseEncrypted): Promise<Expense> {
  const crypto = useCryptoStore()
  return {
    ...raw,
    budgeted: await crypto.decrypt<number>(raw.budgeted),
    actual: raw.actual ? await crypto.decrypt<number>(raw.actual) : 0,
  }
}

/** Descifra una Transaction del servidor */
async function decryptTransaction(raw: TransactionEncrypted): Promise<Transaction> {
  const crypto = useCryptoStore()
  return {
    ...raw,
    amount: await crypto.decrypt<number>(raw.amount),
  }
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useBudgetStore = defineStore('budget', () => {
  const toast = useToastStore()

  // ── Estado (siempre descifrado) ────────────────────────────────────────
  const budgets      = ref<Budget[]>([])
  const budget       = ref<Budget | null>(null)
  const incomes      = ref<Income[]>([])
  const bills        = ref<Bill[]>([])
  const expenses     = ref<Expense[]>([])
  const transactions = ref<Transaction[]>([])
  const loading      = ref(false)
  const error        = ref<string | null>(null)
  // Señal reactiva: true cuando el cifrado no está disponible y los datos no pudieron descifrarse
  const degraded     = ref(false)

  // ── Computed: calculos financieros locales ──────────────────────────────

  /** Total de ingresos presupuestados */
  const totalIngresos = computed(() => totalBudgetedIncome(incomes.value))

  /** Total de facturas pagadas (actual) */
  const totalFacturas = computed(() => totalActualBills(bills.value))

  /** Total presupuestado en facturas */
  const totalGastosFijos = computed(() => totalBudgetedBills(bills.value))

  /** Total presupuestado en gastos variables */
  const totalGastosVariables = computed(() => totalBudgetedExpenses(expenses.value))

  // E2EE: el servidor no puede calcular el `actual` por categoría porque los
  // montos de cada transacción viajan cifrados. El agregado se hace en RAM del
  // cliente tras descifrar.
  const expensesWithActuals = computed<Expense[]>(() =>
    expenses.value.map(exp => ({
      ...exp,
      actual: actualForExpense(transactions.value, exp.category),
    }))
  )

  /** Total de transacciones registradas */
  const totalTransacciones = computed(() => totalSpent(transactions.value))

  /** Gasto total = facturas pagadas + transacciones */
  const totalGastado = computed(() => totalFacturas.value + totalTransacciones.value)

  /** Saldo disponible */
  const disponible = computed(() => totalIngresos.value - totalGastado.value)

  /** Resumen 50/30/20 calculado localmente */
  const summary = computed<BudgetSummary | null>(() => {
    if (!budget.value) return null
    return calculateSummary(incomes.value, bills.value, expenses.value, transactions.value)
  })

  // ── Compatibilidad: exponer "current" como BudgetFull para componentes existentes ──
  const current = computed<BudgetFull | null>(() => {
    if (!budget.value) return null
    return {
      ...budget.value,
      incomes: incomes.value,
      bills: bills.value,
      expenses: expenses.value,
      transactions: transactions.value,
    }
  })

  // ── Acciones: Presupuestos ─────────────────────────────────────────────

  /**
   * Carga la lista de presupuestos del usuario. El backend devuelve los
   * `incomes` cifrados como relación (E2EE: no puede sumarlos del lado server).
   * Acá descifrámos cada `budgeted` y agregamos el resultado como `totalIncome`
   * para que la card del listado tenga el monto real sin tocar la vista.
   */
  async function fetchAll() {
    loading.value = true
    error.value   = null
    try {
      const raw         = await BudgetService.getAll()
      const cryptoStore = useCryptoStore()

      // Sin clave activa no podemos descifrar — devolvemos los budgets con
      // totalIncome=0. El usuario verá $0 en la lista, pero al entrar al
      // detalle el flujo degraded existente le explica cómo desbloquear.
      if (!cryptoStore.isReady) {
        budgets.value = raw.map(({ id, year, month, createdAt }) => ({
          id, year, month, totalIncome: 0, createdAt,
        }))
        return
      }

      // Descifra los `budgeted` de cada Income en paralelo y suma por budget.
      // Devolvemos un Budget "limpio" (sin incomes cifrados) para no exponer
      // payloads E2EE al resto de la app — la lista solo necesita el total.
      budgets.value = await Promise.all(raw.map(async b => {
        const montos = await Promise.all(
          (b.incomes ?? []).map(i => cryptoStore.decrypt<number>(i.budgeted)),
        )
        return {
          id:          b.id,
          year:        b.year,
          month:       b.month,
          totalIncome: montos.reduce((s, n) => s + Number(n), 0),
          createdAt:   b.createdAt,
        }
      }))
    } catch (e) {
      error.value = _extractError(e)
    } finally {
      loading.value = false
    }
  }

  /**
   * Carga un presupuesto completo, descifra todas las entidades monetarias
   * y almacena los datos descifrados en el estado local.
   */
  async function fetchOne(id: string) {
    // Guarda de lectura: sin clave activa no podemos descifrar los datos
    const cryptoStore = useCryptoStore()
    if (!cryptoStore.isReady) {
      degraded.value = true
      error.value    = MSG_CRYPTO_READ_BLOCKED
      return
    }

    loading.value = true
    error.value   = null
    try {
      const encrypted = await BudgetService.getOne(id)

      // Descifrar todas las entidades en paralelo
      const [decIncomes, decBills, decExpenses, decTransactions] = await Promise.all([
        Promise.all(encrypted.incomes.map(i => decryptIncome(i))),
        Promise.all(encrypted.bills.map(b => decryptBill(b))),
        Promise.all(encrypted.expenses.map(e => decryptExpense(e))),
        Promise.all(encrypted.transactions.map(t => decryptTransaction(t))),
      ])

      // Guardar el budget base y las relaciones descifradas por separado
      budget.value       = {
        id: encrypted.id,
        year: encrypted.year,
        month: encrypted.month,
        totalIncome: encrypted.totalIncome,
        createdAt: encrypted.createdAt,
      }
      incomes.value      = decIncomes
      bills.value        = decBills
      expenses.value     = decExpenses
      transactions.value = decTransactions
      // Cifrado activo y descifrado exitoso — resetear estado degradado anterior
      degraded.value = false
    } catch (e) {
      // Si un helper de descifrado lanza, marcamos estado degradado
      degraded.value = true
      error.value    = _extractError(e)
    } finally {
      loading.value = false
    }
  }

  /** Crea un nuevo presupuesto para el mes y anio indicados */
  async function createBudget(year: number, month: number): Promise<Budget | null> {
    loading.value = true
    error.value   = null
    try {
      const nuevo = await BudgetService.create(year, month)
      budgets.value.unshift(nuevo)
      toast.success('Presupuesto creado correctamente')
      return nuevo
    } catch (e) {
      error.value = _extractError(e)
      return null
    } finally {
      loading.value = false
    }
  }

  // ── Guarda de escritura: corta si el cifrado no está activo ──────────────

  /**
   * Devuelve el mensaje de toast adecuado según si la clave es recuperable o no.
   * Si retorna un string, la acción debe abortar; si retorna null, puede continuar.
   */
  function _cryptoWriteGuard(): string | null {
    const cryptoStore = useCryptoStore()
    if (!cryptoStore.isReady) {
      const auth = useAuthStore()
      return (auth.user && cryptoStore.canRestore(auth.user.id))
        ? MSG_CRYPTO_WRITE_BLOCKED
        : MSG_CRYPTO_WRITE_UNRECOVERABLE
    }
    return null
  }

  // ── Acciones: Ingresos ─────────────────────────────────────────────────

  /** Cifra y envia un ingreso al servidor, luego recarga el presupuesto */
  async function addIncome(payload: { name: string; budgeted: number; actual?: number }) {
    if (!budget.value) return
    // Guarda de escritura: sin cifrado activo abortamos con mensaje al usuario
    const guardMsg = _cryptoWriteGuard()
    if (guardMsg) { toast.error(guardMsg); return }

    const crypto = useCryptoStore()
    const budgetId = budget.value.id
    try {
      const encrypted = {
        name: payload.name,
        budgeted: await crypto.encrypt(payload.budgeted),
        actual: payload.actual != null ? await crypto.encrypt(payload.actual) : null,
      }
      await BudgetService.addIncome(budgetId, encrypted)
      await fetchOne(budgetId)
      toast.success(`Ingreso "${payload.name}" agregado`)
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  /** Edita un ingreso existente. Cifra budgeted/actual antes de mandar al
   *  backend; los demás campos viajan en plain. Sigue el mismo patrón que
   *  addIncome — recarga el budget con fetchOne() para refrescar el estado
   *  local descifrado. */
  async function updateIncome(
    incomeId: string,
    payload: { name?: string; budgeted?: number; actual?: number | null },
  ) {
    if (!budget.value) return
    // Guarda de escritura: sin cifrado activo abortamos con mensaje al usuario
    const guardMsg = _cryptoWriteGuard()
    if (guardMsg) { toast.error(guardMsg); return }

    const crypto   = useCryptoStore()
    const budgetId = budget.value.id
    try {
      // Solo enviamos los campos presentes en el payload — el backend hace
      // PartialType, así que omitidos = no se tocan.
      const encrypted: {
        name?:     string
        budgeted?: import('@/types/budget.types').EncryptedField
        actual?:   import('@/types/budget.types').EncryptedField | null
      } = {}
      if (payload.name !== undefined) encrypted.name = payload.name
      if (payload.budgeted !== undefined) encrypted.budgeted = await crypto.encrypt(payload.budgeted)
      if (payload.actual !== undefined) {
        encrypted.actual = payload.actual === null ? null : await crypto.encrypt(payload.actual)
      }

      await BudgetService.updateIncome(budgetId, incomeId, encrypted)
      await fetchOne(budgetId)
      toast.success('Ingreso actualizado')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  async function removeIncome(incomeId: string) {
    if (!budget.value) return
    const budgetId = budget.value.id
    try {
      await BudgetService.deleteIncome(budgetId, incomeId)
      incomes.value = incomes.value.filter(i => i.id !== incomeId)
      toast.success('Ingreso eliminado')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  // ── Acciones: Facturas ─────────────────────────────────────────────────

  /** Cifra y envia una factura al servidor, luego recarga el presupuesto */
  async function addBill(payload: {
    name: string
    budgeted: number
    actual: number
    dueDate: string | null
    paymentType: PaymentType | null
  }) {
    if (!budget.value) return
    // Guarda de escritura: sin cifrado activo abortamos con mensaje al usuario
    const guardMsg = _cryptoWriteGuard()
    if (guardMsg) { toast.error(guardMsg); return }

    const crypto = useCryptoStore()
    const budgetId = budget.value.id
    try {
      const encrypted = {
        name: payload.name,
        budgeted: await crypto.encrypt(payload.budgeted),
        actual: payload.actual != null ? await crypto.encrypt(payload.actual) : null,
        dueDate: payload.dueDate,
        paymentType: payload.paymentType,
      }
      await BudgetService.addBill(budgetId, encrypted)
      await fetchOne(budgetId)
      toast.success(`Factura "${payload.name}" agregada`)
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  /** Marca una factura como pagada/pendiente y recarga para descifrar */
  async function toggleBillPaid(billId: string, isPaid: boolean) {
    // Guarda de escritura: debe dispararse ANTES del if (!budget.value) para bloquear en cascada
    const guardMsg = _cryptoWriteGuard()
    if (guardMsg) { toast.error(guardMsg); return }

    if (!budget.value) return
    const budgetId = budget.value.id
    try {
      await BudgetService.markBillPaid(budgetId, billId, isPaid)
      await fetchOne(budgetId)
      toast.success(isPaid ? 'Factura marcada como pagada' : 'Factura marcada como pendiente')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  /** Edita una factura existente. Cifra budgeted/actual antes de mandar al
   *  backend; los demás campos viajan en plain. Mismo patrón que addBill —
   *  recarga el budget con fetchOne() para refrescar el estado local. */
  async function updateBill(
    billId: string,
    payload: {
      name?:        string
      budgeted?:    number
      actual?:      number | null
      dueDate?:     string | null
      paymentType?: PaymentType | null
    },
  ) {
    if (!budget.value) return
    // Guarda de escritura: sin cifrado activo abortamos con mensaje al usuario
    const guardMsg = _cryptoWriteGuard()
    if (guardMsg) { toast.error(guardMsg); return }

    const crypto   = useCryptoStore()
    const budgetId = budget.value.id
    try {
      // Solo enviamos los campos presentes — backend usa PartialType.
      const encrypted: {
        name?:        string
        budgeted?:    import('@/types/budget.types').EncryptedField
        actual?:      import('@/types/budget.types').EncryptedField | null
        dueDate?:     string | null
        paymentType?: PaymentType | null
      } = {}
      if (payload.name !== undefined) encrypted.name = payload.name
      if (payload.budgeted !== undefined) encrypted.budgeted = await crypto.encrypt(payload.budgeted)
      if (payload.actual !== undefined) {
        encrypted.actual = payload.actual === null ? null : await crypto.encrypt(payload.actual)
      }
      if (payload.dueDate     !== undefined) encrypted.dueDate     = payload.dueDate
      if (payload.paymentType !== undefined) encrypted.paymentType = payload.paymentType

      await BudgetService.updateBill(budgetId, billId, encrypted)
      await fetchOne(budgetId)
      toast.success('Factura actualizada')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  async function removeBill(billId: string) {
    if (!budget.value) return
    const budgetId = budget.value.id
    try {
      await BudgetService.deleteBill(budgetId, billId)
      bills.value = bills.value.filter(b => b.id !== billId)
      toast.success('Factura eliminada')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  // ── Acciones: Gastos variables ─────────────────────────────────────────

  /** Cifra y envia un gasto al servidor, luego recarga el presupuesto */
  async function addExpense(payload: { category: ExpenseCategory; budgeted: number }) {
    if (!budget.value) return
    // Guarda de escritura: sin cifrado activo abortamos con mensaje al usuario
    const guardMsg = _cryptoWriteGuard()
    if (guardMsg) { toast.error(guardMsg); return }

    const crypto = useCryptoStore()
    const budgetId = budget.value.id
    try {
      const encrypted = {
        category: payload.category,
        budgeted: await crypto.encrypt(payload.budgeted),
      }
      await BudgetService.addExpense(budgetId, encrypted)
      await fetchOne(budgetId)
      toast.success(`Categoria "${payload.category}" configurada`)
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  async function removeExpense(expenseId: string) {
    if (!budget.value) return
    const budgetId = budget.value.id
    try {
      await BudgetService.deleteExpense(budgetId, expenseId)
      expenses.value = expenses.value.filter(e => e.id !== expenseId)
      toast.success('Categoria de gasto eliminada')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  // ── Acciones: Transacciones ────────────────────────────────────────────

  /**
   * Cifra y envia una transaccion al servidor, luego recarga el presupuesto.
   * Devuelve la TransactionEncrypted creada (con id) para que los callers
   * que necesiten linkearla (ej: debts.store en el mirror Opción C) tengan el ID.
   * Retorna null si no hay budget activo o si el guard de cifrado aborta.
   */
  async function addTransaction(payload: {
    amount: number
    category: ExpenseCategory
    paymentType: PaymentType | null
    note: string | null
    date: string
  }): Promise<TransactionEncrypted | null> {
    if (!budget.value) return null
    // Guarda de escritura: sin cifrado activo abortamos con mensaje al usuario
    const guardMsg = _cryptoWriteGuard()
    if (guardMsg) { toast.error(guardMsg); return null }

    const crypto = useCryptoStore()
    const budgetId = budget.value.id
    try {
      const encrypted = {
        amount: await crypto.encrypt(payload.amount),
        category: payload.category,
        paymentType: payload.paymentType,
        note: payload.note,
        date: payload.date,
      }
      const created = await BudgetService.addTransaction(budgetId, encrypted)
      await fetchOne(budgetId)
      toast.success('Gasto registrado correctamente')
      return created
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  async function removeTransaction(txId: string) {
    if (!budget.value) return
    const budgetId = budget.value.id
    try {
      await BudgetService.deleteTransaction(budgetId, txId)
      transactions.value = transactions.value.filter(t => t.id !== txId)
      toast.success('Gasto eliminado')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  // ── Utilidades ─────────────────────────────────────────────────────────

  function clearCurrent() {
    budget.value       = null
    incomes.value      = []
    bills.value        = []
    expenses.value     = []
    transactions.value = []
  }

  function _extractError(e: unknown): string {
    if (e && typeof e === 'object' && 'response' in e) {
      const r = (e as { response?: { data?: { message?: string | string[] } } }).response
      const msg = r?.data?.message
      if (Array.isArray(msg)) return msg.join(', ')
      return msg ?? 'Error inesperado'
    }
    return 'Error inesperado'
  }

  return {
    // Estado
    budgets,
    budget,
    current,
    incomes,
    bills,
    expenses,
    transactions,
    summary,
    loading,
    error,
    // Señal de estado degradado (solo lectura para las vistas)
    degraded: readonly(degraded),
    // Computed financieros
    totalIngresos,
    totalFacturas,
    totalGastosFijos,
    totalGastosVariables,
    expensesWithActuals,
    totalTransacciones,
    totalGastado,
    disponible,
    // Acciones
    fetchAll,
    fetchOne,
    createBudget,
    addIncome,
    updateIncome,
    removeIncome,
    addBill,
    updateBill,
    toggleBillPaid,
    removeBill,
    addExpense,
    removeExpense,
    addTransaction,
    removeTransaction,
    clearCurrent,
  }
})
