// Tests unitarios del store de deudas — cubre lista, pagos y planes
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDebtsStore } from '@/stores/debts.store'
import DebtsService from '@/services/debts.service'
import type { Debt, DebtPayment, DebtPlan } from '@/types/debt.types'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('@/services/debts.service')
vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    success: vi.fn(),
    error:   vi.fn(),
  }),
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────
const mockDebt: Debt = {
  id:               'debt-1',
  name:             'Tarjeta BBVA',
  type:             'credit_card',
  initialAmount:    30000,
  remainingBalance: 22000,
  interestRate:     36,
  minimumPayment:   800,
  dueDay:           15,
  status:           'active',
  priorityOrder:    1,
  createdAt:        '2026-01-01T00:00:00Z',
}

const mockDebt2: Debt = {
  ...mockDebt,
  id:            'debt-2',
  name:          'Préstamo personal',
  priorityOrder: 2,
  status:        'active',
}

const mockPayment: DebtPayment = {
  id:           'pay-1',
  debtId:       'debt-1',
  actualAmount: 1000,
  paymentDate:  '2026-04-01',
  note:         'Pago extra',
}

const mockPlan: DebtPlan = {
  strategy:      'snowball',
  totalInterest: 5000,
  months:        18,
  steps: [],
}

// ── Suite principal ────────────────────────────────────────────────────────────
describe('useDebtsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── Estado inicial ──────────────────────────────────────────────────────────
  it('inicia con estado vacío y computed en cero', () => {
    const store = useDebtsStore()
    expect(store.debts).toEqual([])
    expect(store.totalInitial).toBe(0)
    expect(store.totalRemaining).toBe(0)
    expect(store.globalProgress).toBe(0)
    expect(store.totalMinPayment).toBe(0)
  })

  // ── fetchAll ────────────────────────────────────────────────────────────────
  it('fetchAll — ordena las deudas por priorityOrder ascendente', async () => {
    // El servicio devuelve las deudas en orden inverso
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt2, mockDebt])
    const store = useDebtsStore()

    await store.fetchAll()

    expect(store.debts[0].id).toBe('debt-1')
    expect(store.debts[1].id).toBe('debt-2')
  })

  it('fetchAll — almacena el error en caso de fallo', async () => {
    vi.mocked(DebtsService.getAll).mockRejectedValue({
      response: { data: { message: 'Unauthorized' } },
    })
    const store = useDebtsStore()

    await store.fetchAll()

    expect(store.error).toBe('Unauthorized')
    expect(store.debts).toEqual([])
  })

  // ── Computed: totales ───────────────────────────────────────────────────────
  it('totalInitial y totalRemaining calculan correctamente', async () => {
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt, mockDebt2])
    const store = useDebtsStore()
    await store.fetchAll()

    // Ambas tienen initialAmount=30000 y remainingBalance=22000
    expect(store.totalInitial).toBe(60000)
    expect(store.totalRemaining).toBe(44000)
    expect(store.totalPaid).toBe(16000)
  })

  it('globalProgress — calcula el porcentaje correctamente', async () => {
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt, mockDebt2])
    const store = useDebtsStore()
    await store.fetchAll()

    // pagado=16000 / inicial=60000 ≈ 26.67 → redondeado a 27
    expect(store.globalProgress).toBe(27)
  })

  it('globalProgress — devuelve 0 cuando no hay deudas (evita división por cero)', () => {
    const store = useDebtsStore()
    expect(store.globalProgress).toBe(0)
  })

  // ── activeDebts ─────────────────────────────────────────────────────────────
  it('activeDebts — filtra solo las deudas con status "active"', async () => {
    const paidDebt: Debt = { ...mockDebt, id: 'debt-3', status: 'paid' }
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt, paidDebt])
    const store = useDebtsStore()
    await store.fetchAll()

    expect(store.activeDebts).toHaveLength(1)
    expect(store.activeDebts[0].id).toBe('debt-1')
  })

  // ── totalMinPayment ─────────────────────────────────────────────────────────
  it('totalMinPayment — suma solo deudas activas', async () => {
    const paidDebt: Debt = { ...mockDebt2, id: 'debt-3', status: 'paid', minimumPayment: 500 }
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt, mockDebt2, paidDebt])
    const store = useDebtsStore()
    await store.fetchAll()

    // Solo debt-1 (800) y debt-2 (800) son activas; paidDebt (500) se excluye
    expect(store.totalMinPayment).toBe(1600)
  })

  // ── Modelo de capital real: totales solo de ACTIVAS + totalInterestPaid ─────
  describe('modelo de capital real', () => {
    const activeA: Debt = { ...mockDebt, id: 'a', status: 'active', initialAmount: 20000, remainingBalance: 18000 }
    const activeB: Debt = { ...mockDebt, id: 'b', status: 'active', initialAmount: 10000, remainingBalance: 9000 }
    const liquidated: Debt = { ...mockDebt, id: 'c', status: 'paid', initialAmount: 50000, remainingBalance: 0 }

    it('totalInitial suma SOLO deudas activas (excluye liquidadas)', async () => {
      vi.mocked(DebtsService.getAll).mockResolvedValue([activeA, activeB, liquidated])
      const store = useDebtsStore()
      await store.fetchAll()

      // Solo activas: 20000 + 10000 = 30000 (NO incluye la liquidada de 50000)
      expect(store.totalInitial).toBe(30000)
    })

    it('totalRemaining suma SOLO deudas activas', async () => {
      vi.mocked(DebtsService.getAll).mockResolvedValue([activeA, activeB, liquidated])
      const store = useDebtsStore()
      await store.fetchAll()

      expect(store.totalRemaining).toBe(27000) // 18000 + 9000
    })

    it('globalProgress refleja solo el avance de deudas activas', async () => {
      vi.mocked(DebtsService.getAll).mockResolvedValue([activeA, activeB, liquidated])
      const store = useDebtsStore()
      await store.fetchAll()

      // pagado activas = 30000 - 27000 = 3000 → 3000/30000 = 10%
      // Si incluyera la liquidada: (50000+3000)/80000 = 66% → test detecta el inflado
      expect(store.globalProgress).toBe(10)
    })

    it('totalInterestPaid suma interestPaid de todos los pagos de todas las deudas', async () => {
      const mkPay = (interestPaid: number, capitalPaid: number): DebtPayment => ({
        id: 'p', debtId: 'x', paymentDate: '2026-01-01', expectedAmount: 0,
        actualAmount: interestPaid + capitalPaid, balanceAfterPayment: 0,
        interestPaid, capitalPaid, isPaid: true, note: null,
      })
      const debtWithPayments: Debt = {
        ...activeA,
        payments: [mkPay(1008.33, 991.67), mkPay(950, 1050)],
      }
      const debtWithPayments2: Debt = {
        ...activeB,
        payments: [mkPay(500, 500)],
      }
      vi.mocked(DebtsService.getAll).mockResolvedValue([debtWithPayments, debtWithPayments2])
      const store = useDebtsStore()
      await store.fetchAll()

      // 1008.33 + 950 + 500 = 2458.33
      expect(store.totalInterestPaid).toBeCloseTo(2458.33, 2)
    })

    it('totalInterestPaid es 0 cuando las deudas no tienen pagos', async () => {
      vi.mocked(DebtsService.getAll).mockResolvedValue([activeA, activeB])
      const store = useDebtsStore()
      await store.fetchAll()

      expect(store.totalInterestPaid).toBe(0)
    })
  })

  // ── createDebt ──────────────────────────────────────────────────────────────
  it('createDebt — agrega la deuda y reordena por prioridad', async () => {
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt2])
    vi.mocked(DebtsService.create).mockResolvedValue(mockDebt)
    const store = useDebtsStore()
    await store.fetchAll()

    const result = await store.createDebt({
      name: 'Tarjeta BBVA', type: 'credit_card',
      initialAmount: 30000, remainingBalance: 22000,
      interestRate: 36, minimumPayment: 800,
      dueDay: 15, priorityOrder: 1,
    })

    expect(result?.id).toBe('debt-1')
    expect(store.debts[0].id).toBe('debt-1') // Prioridad 1 va al inicio
  })

  // ── updateDebt ──────────────────────────────────────────────────────────────
  it('updateDebt — actualiza el registro en lista y en current', async () => {
    const updated = { ...mockDebt, name: 'Tarjeta BBVA Oro' }
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt])
    vi.mocked(DebtsService.update).mockResolvedValue(updated)
    const store = useDebtsStore()
    await store.fetchAll()
    store.current = mockDebt

    await store.updateDebt('debt-1', { name: 'Tarjeta BBVA Oro' })

    expect(store.debts[0].name).toBe('Tarjeta BBVA Oro')
    expect(store.current?.name).toBe('Tarjeta BBVA Oro')
  })

  // ── removeDebt ──────────────────────────────────────────────────────────────
  it('removeDebt — elimina la deuda y limpia current si coincide', async () => {
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt])
    vi.mocked(DebtsService.remove).mockResolvedValue(undefined)
    const store = useDebtsStore()
    await store.fetchAll()
    store.current = mockDebt

    await store.removeDebt('debt-1')

    expect(store.debts).toHaveLength(0)
    expect(store.current).toBeNull()
  })

  // ── registerPayment ─────────────────────────────────────────────────────────
  it('registerPayment — actualiza saldo desde balanceAfterPayment sin petición extra', async () => {
    // El pago devuelve balanceAfterPayment = 21000 (después de aplicar capital)
    const pagoConSaldo: DebtPayment = { ...mockPayment, balanceAfterPayment: 21000 }
    vi.mocked(DebtsService.getAll).mockResolvedValue([mockDebt])
    vi.mocked(DebtsService.registerPayment).mockResolvedValue(pagoConSaldo)
    const store = useDebtsStore()
    await store.fetchAll()
    store.current = { ...mockDebt }  // Simula que la vista de detalle está activa

    await store.registerPayment('debt-1', { actualAmount: 1000, paymentDate: '2026-04-01', note: '' })

    // El pago aparece al inicio de la lista
    expect(store.payments[0].id).toBe('pay-1')
    // current.remainingBalance se actualiza con balanceAfterPayment del pago
    expect(Number(store.current?.remainingBalance)).toBe(21000)
    // La lista global también se actualiza (sin GET extra)
    expect(Number(store.debts[0].remainingBalance)).toBe(21000)
    // No se llamó a getOne (sin petición extra al backend)
    expect(DebtsService.getOne).not.toHaveBeenCalled()
  })

  // ── fetchAllPlans ───────────────────────────────────────────────────────────
  it('fetchAllPlans — carga los tres planes en paralelo', async () => {
    const avalanche: DebtPlan = { ...mockPlan, strategy: 'avalanche' }
    const fireball:  DebtPlan = { ...mockPlan, strategy: 'fireball'  }
    vi.mocked(DebtsService.getSnowballPlan).mockResolvedValue(mockPlan)
    vi.mocked(DebtsService.getAvalanchePlan).mockResolvedValue(avalanche)
    vi.mocked(DebtsService.getFireballPlan).mockResolvedValue(fireball)
    const store = useDebtsStore()

    await store.fetchAllPlans()

    expect(store.planSnowball?.strategy).toBe('snowball')
    expect(store.planAvalanche?.strategy).toBe('avalanche')
    expect(store.planFireball?.strategy).toBe('fireball')
    expect(store.plansLoading).toBe(false)
  })

  // ── clearCurrent ────────────────────────────────────────────────────────────
  it('clearCurrent — resetea current, payments y amortization', () => {
    const store = useDebtsStore()
    store.current       = mockDebt
    store.payments      = [mockPayment]
    store.amortization  = [{ month: 1, payment: 800, principal: 200, interest: 600, balance: 21800 }]

    store.clearCurrent()

    expect(store.current).toBeNull()
    expect(store.payments).toEqual([])
    expect(store.amortization).toEqual([])
  })
})
