// Store del módulo de deudas — gestiona lista, detalle, pagos y planes de liquidación
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import DebtsService from '@/services/debts.service'
import type { Debt, CreateDebtPayload, DebtPayment, AmortizationRow, DebtPlan } from '@/types/debt.types'
import { useToastStore } from '@/stores/toast.store'

export const useDebtsStore = defineStore('debts', () => {
  const toast = useToastStore()

  // ── Estado ───────────────────────────────────────────────────────────────
  const debts        = ref<Debt[]>([])           // Lista completa de deudas del usuario
  const current      = ref<Debt | null>(null)     // Deuda activa en el detalle
  const payments     = ref<DebtPayment[]>([])     // Pagos de la deuda activa
  const amortization = ref<AmortizationRow[]>([]) // Tabla de amortización proyectada

  /** Metadata de la proyección — flag + números puntuales para el banner de
   *  advertencia cuando la deuda entra en amortización negativa (pago < interés
   *  del primer mes), y campos extra para el modo FlexPlan (IVA sobre intereses).
   *  null mientras no se haya hecho fetch. */
  const amortizationMeta = ref<{
    mode:                   'standard' | 'flexplan'
    isNegativeAmortization: boolean
    interesPrimerMes:       number
    pagoEsperado:           number
    totalIVA:               number
    totalPagadoConIVA:      number
  } | null>(null)

  // Planes de liquidación (se cargan bajo demanda)
  const planSnowball  = ref<DebtPlan | null>(null)
  const planAvalanche = ref<DebtPlan | null>(null)
  const planFireball  = ref<DebtPlan | null>(null)
  const plansLoading  = ref(false)

  const loading = ref(false)
  const error   = ref<string | null>(null)

  // ── Computed ─────────────────────────────────────────────────────────────
  // Solo deudas activas (no liquidadas) — base para TODOS los totales
  const activeDebts = computed(() => debts.value.filter(d => d.status === 'active'))

  // Capital inicial total de deudas ACTIVAS (las liquidadas se excluyen —
  // lo histórico se ve en otra vista, no infla el progreso actual).
  const totalInitial = computed(() =>
    activeDebts.value.reduce((s, d) => s + Number(d.initialAmount), 0)
  )

  // Capital restante de deudas ACTIVAS. Representa el CAPITAL real pendiente
  // (no incluye interés futuro). Ver modelo en registerPayment del backend.
  const totalRemaining = computed(() =>
    activeDebts.value.reduce((s, d) => s + Number(d.remainingBalance), 0)
  )

  // Capital amortizado = parte del pago que efectivamente redujo la deuda.
  // El interés pagado NO entra acá — se trackea aparte en totalInterestPaid.
  const totalPaid = computed(() => totalInitial.value - totalRemaining.value)

  // Intereses pagados al banco en TODAS las deudas (activas + liquidadas).
  // Este número es "plata que se fue" — útil para tomar conciencia del costo real.
  const totalInterestPaid = computed(() =>
    debts.value.reduce((sum, d) => {
      const pagos = d.payments ?? []
      return sum + pagos.reduce((s, p) => s + Number(p.interestPaid ?? 0), 0)
    }, 0)
  )

  // Porcentaje de avance sobre capital real, solo deudas activas.
  const globalProgress = computed(() => {
    if (!totalInitial.value) return 0
    return Math.round((totalPaid.value / totalInitial.value) * 100)
  })

  // Pago mínimo mensual total (suma de todas las deudas activas)
  const totalMinPayment = computed(() =>
    activeDebts.value.reduce((s, d) => s + Number(d.minimumPayment), 0)
  )

  /**
   * Deudas activas cuyo pago mínimo del mes calendario actual todavía NO
   * se registró en el sistema. Son las que el dashboard resta del
   * "disponible real" y muestra en el chip "pagos pendientes".
   *
   * Anti-doble-contabilización: si el usuario registra el pago, hasPaymentThisMonth
   * pasa a true desde el backend y la deuda deja de aparecer acá.
   */
  const pagosPendientesEsteMes = computed(() =>
    activeDebts.value.filter(d => !d.hasPaymentThisMonth)
  )

  /** Suma de pagos mínimos de deudas activas sin pago registrado este mes. */
  const totalPendienteEsteMes = computed(() =>
    pagosPendientesEsteMes.value.reduce((s, d) => s + Number(d.minimumPayment), 0)
  )

  // ── Acciones: Lista de deudas ─────────────────────────────────────────────

  async function fetchAll() {
    loading.value = true
    error.value   = null
    try {
      debts.value = await DebtsService.getAll()
      // Ordenar por prioridad ascendente
      debts.value.sort((a, b) => a.priorityOrder - b.priorityOrder)
    } catch (e) {
      error.value = _extractError(e)
    } finally {
      loading.value = false
    }
  }

  // Usa CreateDebtPayload para no incluir campos de solo lectura (id, createdAt, etc.)
  async function createDebt(payload: CreateDebtPayload): Promise<Debt | null> {
    loading.value = true
    error.value   = null
    try {
      const nueva = await DebtsService.create(payload)
      debts.value.push(nueva)
      debts.value.sort((a, b) => a.priorityOrder - b.priorityOrder)
      toast.success(`Deuda "${nueva.name}" creada correctamente`)
      return nueva
    } catch (e) {
      error.value = _extractError(e)
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateDebt(id: string, payload: Partial<Debt>): Promise<void> {
    try {
      const actualizada = await DebtsService.update(id, payload)
      const idx = debts.value.findIndex(d => d.id === id)
      if (idx !== -1) debts.value[idx] = actualizada
      if (current.value?.id === id) current.value = actualizada
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  async function removeDebt(id: string): Promise<void> {
    loading.value = true
    try {
      await DebtsService.remove(id)
      debts.value = debts.value.filter(d => d.id !== id)
      if (current.value?.id === id) current.value = null
      toast.success('Deuda eliminada')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // ── Acciones: Detalle de deuda ────────────────────────────────────────────

  async function fetchOne(id: string) {
    loading.value = true
    error.value   = null
    try {
      current.value = await DebtsService.getOne(id)
    } catch (e) {
      error.value = _extractError(e)
    } finally {
      loading.value = false
    }
  }

  // ── Acciones: Pagos ───────────────────────────────────────────────────────

  async function fetchPayments(debtId: string) {
    try {
      payments.value = await DebtsService.getPayments(debtId)
    } catch (e) {
      error.value = _extractError(e)
    }
  }

  async function registerPayment(
    debtId: string,
    payload: Pick<DebtPayment, 'actualAmount' | 'paymentDate' | 'note'>
  ) {
    try {
      const nuevoPago = await DebtsService.registerPayment(debtId, payload)

      // Nombre de la deuda para la nota de la transacción — lo tomamos antes
      // de mutar los arrays locales.
      const debtBefore = debts.value.find(d => d.id === debtId)

      // Agrega el pago al inicio de la lista (más reciente primero)
      payments.value.unshift(nuevoPago)

      // El pago ya incluye `balanceAfterPayment` — actualizamos sin petición extra.
      // Marcamos hasPaymentThisMonth = true para que el dashboard deje de
      // descontarlo del disponible (anti-doble-contabilización).
      if (current.value?.id === debtId) {
        current.value = {
          ...current.value,
          remainingBalance:     nuevoPago.balanceAfterPayment,
          status:               nuevoPago.balanceAfterPayment === 0 ? 'paid' : current.value.status,
          hasPaymentThisMonth:  true,
        }
      }

      // Sincroniza también la lista global de deudas
      const idx = debts.value.findIndex(d => d.id === debtId)
      if (idx !== -1) {
        debts.value[idx] = {
          ...debts.value[idx],
          remainingBalance:     nuevoPago.balanceAfterPayment,
          status:               nuevoPago.balanceAfterPayment === 0 ? 'paid' : debts.value[idx].status,
          hasPaymentThisMonth:  true,
        }
      }

      toast.success('Pago registrado correctamente')

      // ── Auto-transacción en el budget activo (Opción C) ──────────────
      // Creamos una Transaction en el budget del mes para que el pago se
      // refleje en los gastos y el "disponible real" del dashboard cuadre
      // sin necesidad de carga manual por parte del usuario.
      // Best-effort: si falla (sin budget activo, error de red), log y seguimos —
      // el DebtPayment ya está persistido con éxito.
      await _mirrorPaymentToBudget(nuevoPago, debtId, debtBefore?.name ?? 'Deuda')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  async function updatePayment(
    debtId: string,
    paymentId: string,
    payload: { actualAmount?: number; paymentDate?: string; note?: string }
  ) {
    try {
      const actualizado = await DebtsService.updatePayment(debtId, paymentId, payload)
      const idx = payments.value.findIndex(p => p.id === paymentId)
      if (idx !== -1) payments.value[idx] = actualizado
      // Refresca el saldo de la deuda activa
      if (current.value?.id === debtId) await fetchOne(debtId)
      toast.success('Pago actualizado correctamente')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  async function removePayment(debtId: string, paymentId: string) {
    try {
      await DebtsService.removePayment(debtId, paymentId)
      payments.value = payments.value.filter(p => p.id !== paymentId)
      // Refresca el saldo de la deuda activa
      if (current.value?.id === debtId) await fetchOne(debtId)
      toast.success('Pago eliminado correctamente')
    } catch (e) {
      error.value = _extractError(e)
      throw e
    }
  }

  // ── Acciones: Tabla de amortización ──────────────────────────────────────

  async function fetchAmortization(debtId: string) {
    try {
      const data = await DebtsService.getAmortization(debtId)
      amortization.value = data.tabla
      amortizationMeta.value = {
        mode:                   data.mode,
        isNegativeAmortization: data.isNegativeAmortization,
        interesPrimerMes:       data.interesPrimerMes,
        pagoEsperado:           data.pagoEsperado,
        totalIVA:               data.totalIVA,
        totalPagadoConIVA:      data.totalPagadoConIVA,
      }
    } catch (e) {
      error.value = _extractError(e)
      amortizationMeta.value = null
    }
  }

  // ── Acciones: Planes de liquidación ──────────────────────────────────────

  // Carga los tres planes en paralelo para el comparador
  async function fetchAllPlans() {
    plansLoading.value = true
    error.value        = null
    try {
      const [snowball, avalanche, fireball] = await Promise.all([
        DebtsService.getSnowballPlan(),
        DebtsService.getAvalanchePlan(),
        DebtsService.getFireballPlan(),
      ])
      planSnowball.value  = snowball
      planAvalanche.value = avalanche
      planFireball.value  = fireball
    } catch (e) {
      error.value = _extractError(e)
    } finally {
      plansLoading.value = false
    }
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  function clearCurrent() {
    current.value          = null
    payments.value         = []
    amortization.value     = []
    amortizationMeta.value = null
  }

  function clearPlans() {
    planSnowball.value  = null
    planAvalanche.value = null
    planFireball.value  = null
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

  /**
   * Crea una Transaction en el budget activo como espejo del DebtPayment y
   * establece el link 1:1 guardando el transactionId en el DebtPayment via PATCH.
   *
   * Flujo (Opción C con linking):
   *   1. addTransaction(...) en el budget → recibe Transaction con id.
   *   2. PATCH /debts/:d/payments/:p con { transactionId } → backend guarda link.
   *   3. Al borrar el pago en el futuro, el backend borra la tx en cascada.
   *
   * Best-effort: no relanza. Si falla (sin budget del mes, crypto no activo,
   * red caída), logueamos y seguimos — el DebtPayment ya fue persistido por el
   * backend y no se pierde. El user verá el pago en /debts pero no en los
   * gastos del mes hasta que regenere el presupuesto.
   *
   * Import dinámico del budget.store para evitar ciclo de dependencias.
   */
  async function _mirrorPaymentToBudget(
    payment: DebtPayment,
    debtId: string,
    debtName: string,
  ): Promise<void> {
    try {
      const { useBudgetStore } = await import('@/stores/budget.store')
      const budgetStore = useBudgetStore()

      // Sin budget activo cargado en memoria → no podemos crear tx.
      if (!budgetStore.budget) {
        console.warn('[debts] No hay budget activo — el pago no se registró como transacción.')
        return
      }

      // Paso 1: crear la tx (con retorno para obtener su id)
      const createdTx = await budgetStore.addTransaction({
        amount:       Number(payment.actualAmount),
        category:     'debt-payment',
        paymentType:  null,
        note:         `Pago de deuda: ${debtName}`,
        date:         String(payment.paymentDate),
      })

      // Paso 2: linkear el payment con el id de la tx
      if (createdTx?.id) {
        try {
          await DebtsService.updatePayment(debtId, payment.id, { transactionId: createdTx.id })
          // Reflejar en el estado local también — útil si el user borra el pago inmediatamente
          payment.transactionId = createdTx.id
          const idx = payments.value.findIndex(p => p.id === payment.id)
          if (idx !== -1) payments.value[idx] = { ...payments.value[idx], transactionId: createdTx.id }
        } catch (linkErr) {
          // La tx existe pero el link no se guardó. El cascade delete no
          // funcionará para este pago — el user tendrá que borrar la tx manual.
          console.warn('[debts] Tx creada pero no se pudo linkear al pago:', linkErr)
        }
      }
    } catch (mirrorErr) {
      // No relanzamos: el pago principal ya fue exitoso.
      console.warn('[debts] No se pudo espejar el pago al budget:', mirrorErr)
    }
  }

  return {
    debts,
    current,
    payments,
    amortization,
    amortizationMeta,
    planSnowball,
    planAvalanche,
    planFireball,
    plansLoading,
    loading,
    error,
    activeDebts,
    totalInitial,
    totalRemaining,
    totalPaid,
    totalInterestPaid,
    globalProgress,
    totalMinPayment,
    pagosPendientesEsteMes,
    totalPendienteEsteMes,
    fetchAll,
    createDebt,
    updateDebt,
    removeDebt,
    fetchOne,
    fetchPayments,
    registerPayment,
    updatePayment,
    removePayment,
    fetchAmortization,
    fetchAllPlans,
    clearCurrent,
    clearPlans,
  }
})
