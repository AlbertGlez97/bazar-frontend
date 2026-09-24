// Tests unitarios del store de presupuesto — cubre CRUD, computed de totales y guardas E2EE
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBudgetStore } from '@/stores/budget.store'
import BudgetService from '@/services/budget.service'
import type { Budget, BudgetFull, Income, Bill, Transaction } from '@/types/budget.types'

// ── Mocks (deben ir ANTES de cualquier import del store bajo prueba) ────────────

// Mock de crypto.store — intercepta isReady y canRestore para simular estado degradado
// Los tests de guardas controlan estos valores por test
const mockIsReady = vi.fn(() => true)
const mockCanRestore = vi.fn(() => true)
const mockEncrypt = vi.fn((v: unknown) => Promise.resolve(`enc:${v}`))
const mockDecrypt = vi.fn((v: string) => Promise.resolve(Number(v.replace('enc:', ''))))

vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: vi.fn(() => ({
    get isReady() { return mockIsReady() },
    canRestore:   mockCanRestore,
    encrypt:      mockEncrypt,
    decrypt:      mockDecrypt,
  })),
}))

// Mock de auth.store — expone user con id para canRestore(auth.user?.id)
const mockUser = vi.fn(() => ({ id: 'user-1' }))
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: vi.fn(() => ({
    get user() { return mockUser() },
  })),
}))

vi.mock('@/services/budget.service')
vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    success: vi.fn(),
    error:   toastErrorSpy,
  }),
}))

// Spy de toast.error compartido para assertar mensajes de guarda
const toastErrorSpy = vi.fn()

// ── Fixtures ───────────────────────────────────────────────────────────────────
const mockBudget: Budget = {
  id:           'bud-1',
  year:         2026,
  month:        4,
  totalIncome:  25000,
  createdAt:    '2026-04-01T00:00:00Z',
}

const mockIncome: Income = {
  id:       'inc-1',
  budgetId: 'bud-1',
  name:     'Salario',
  budgeted: 25000,
  actual:   25000,
}

const mockBill: Bill = {
  id:          'bill-1',
  budgetId:    'bud-1',
  name:        'Renta',
  budgeted:    8000,
  actual:      8000,
  dueDate:     '2026-04-05',
  paymentType: 'transfer',
  isPaid:      false,
}

const mockTransaction: Transaction = {
  id:          'tx-1',
  budgetId:    'bud-1',
  amount:      500,
  category:    'food',
  paymentType: 'cash',
  note:        'Comida',
  date:        '2026-04-01',
}

const mockBudgetFull: BudgetFull = {
  ...mockBudget,
  incomes:      [mockIncome],
  bills:        [mockBill],
  expenses:     [],
  transactions: [mockTransaction],
}

// ── Constantes copiadas del store (para assertar sin acoplar a implementación) ──
const MSG_CRYPTO_WRITE_BLOCKED       = 'No podemos guardar: tu cifrado no está activo. Desbloqueá tu sesión o iniciá sesión de nuevo.'
const MSG_CRYPTO_WRITE_UNRECOVERABLE = 'No podemos guardar: no hay clave recuperable en este dispositivo. Cerrá sesión e iniciá de nuevo.'
const MSG_CRYPTO_READ_BLOCKED        = 'Tus datos están protegidos. Desbloqueá tu cifrado para visualizarlos.'

// ── Suite principal ────────────────────────────────────────────────────────────
describe('useBudgetStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Por defecto crypto está listo y canRestore retorna true
    mockIsReady.mockReturnValue(true)
    mockCanRestore.mockReturnValue(true)
    mockUser.mockReturnValue({ id: 'user-1' })
    // decrypt devuelve el número original (los fixtures ya tienen números, no strings cifrados)
    mockDecrypt.mockImplementation((v: unknown) => Promise.resolve(typeof v === 'number' ? v : Number(v)))
    mockEncrypt.mockImplementation((v: unknown) => Promise.resolve(`enc:${v}`))
  })

  // ── Estado inicial ──────────────────────────────────────────────────────────
  it('inicia con estado vacío y computed en cero', () => {
    const store = useBudgetStore()
    expect(store.budgets).toEqual([])
    expect(store.current).toBeNull()
    expect(store.totalIngresos).toBe(0)
    expect(store.totalGastado).toBe(0)
    expect(store.disponible).toBe(0)
  })

  // ── fetchAll ────────────────────────────────────────────────────────────────
  it('fetchAll — carga la lista de presupuestos', async () => {
    vi.mocked(BudgetService.getAll).mockResolvedValue([mockBudget])
    const store = useBudgetStore()

    await store.fetchAll()

    expect(store.budgets).toHaveLength(1)
    expect(store.budgets[0].id).toBe('bud-1')
    expect(store.loading).toBe(false)
  })

  it('fetchAll — almacena el error en caso de fallo', async () => {
    vi.mocked(BudgetService.getAll).mockRejectedValue({
      response: { data: { message: 'Server error' } },
    })
    const store = useBudgetStore()

    await store.fetchAll()

    expect(store.error).toBe('Server error')
  })

  // ── fetchOne ────────────────────────────────────────────────────────────────
  it('fetchOne — carga el presupuesto completo con relaciones', async () => {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    const store = useBudgetStore()

    await store.fetchOne('bud-1')

    expect(store.current?.id).toBe('bud-1')
    expect(store.current?.incomes).toHaveLength(1)
    expect(store.current?.bills).toHaveLength(1)
    expect(store.current?.transactions).toHaveLength(1)
  })

  // ── Computed: totales ───────────────────────────────────────────────────────
  it('totalIngresos — suma actual si existe, budgeted como fallback', async () => {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    // mockIncome tiene actual=25000, así que se usa actual
    expect(store.totalIngresos).toBe(25000)
  })

  it('totalFacturas — suma el campo actual de cada factura', async () => {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    expect(store.totalFacturas).toBe(8000)
  })

  it('totalTransacciones — suma los montos de las transacciones', async () => {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    expect(store.totalTransacciones).toBe(500)
  })

  it('totalGastado = facturas + transacciones', async () => {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    expect(store.totalGastado).toBe(8500)
  })

  it('disponible = totalIngresos - totalGastado', async () => {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    expect(store.disponible).toBe(25000 - 8500) // 16500
  })

  // ── Computed: expensesWithActuals (hidrata actual client-side por E2EE) ─────
  // El backend NO puede calcular el actual por categoría porque todos los montos
  // viajan cifrados. Este getter suma las transacciones ya descifradas en el
  // cliente y sobrescribe el campo `actual` de cada expense con ese total.
  describe('expensesWithActuals', () => {
    const mkExpense = (id: string, category: string, budgeted: number) => ({
      id, category, budgeted, actual: 0, paymentType: null, budgetId: 'bud-1', createdAt: '2026-04-01T00:00:00Z',
    })
    const mkTx = (id: string, category: string, amount: number) => ({
      id, category, amount, paymentType: 'efectivo' as const, note: null, date: '2026-04-01', budgetId: 'bud-1',
    })

    it('hidrata actual sumando transacciones de la misma categoría', async () => {
      vi.mocked(BudgetService.getOne).mockResolvedValue({
        ...mockBudgetFull,
        expenses: [mkExpense('e-food', 'food', 3000), mkExpense('e-transport', 'transport', 1500)],
        transactions: [
          mkTx('t1', 'food', 500),
          mkTx('t2', 'food', 200),
          mkTx('t3', 'transport', 800),
        ],
      })
      const store = useBudgetStore()
      await store.fetchOne('bud-1')

      const hydrated = store.expensesWithActuals
      expect(hydrated).toHaveLength(2)
      expect(hydrated.find(e => e.category === 'food')?.actual).toBe(700)
      expect(hydrated.find(e => e.category === 'transport')?.actual).toBe(800)
    })

    it('deja actual en 0 cuando la categoría no tiene transacciones', async () => {
      vi.mocked(BudgetService.getOne).mockResolvedValue({
        ...mockBudgetFull,
        expenses: [mkExpense('e-entertainment', 'entertainment', 1000)],
        transactions: [],
      })
      const store = useBudgetStore()
      await store.fetchOne('bud-1')

      expect(store.expensesWithActuals[0].actual).toBe(0)
    })

    it('preserva el budgeted original y no muta expenses del estado', async () => {
      vi.mocked(BudgetService.getOne).mockResolvedValue({
        ...mockBudgetFull,
        expenses: [mkExpense('e-food', 'food', 3000)],
        transactions: [mkTx('t1', 'food', 500)],
      })
      const store = useBudgetStore()
      await store.fetchOne('bud-1')

      expect(store.expensesWithActuals[0].budgeted).toBe(3000)
      // Estado interno NO debe mutarse — actual sigue siendo 0 en el array base
      expect(store.expenses[0].actual).toBe(0)
    })

    it('devuelve array vacío si no hay expenses', () => {
      const store = useBudgetStore()
      expect(store.expensesWithActuals).toEqual([])
    })
  })

  // ── createBudget ────────────────────────────────────────────────────────────
  it('createBudget — agrega el presupuesto al inicio de la lista', async () => {
    const existing: Budget = { ...mockBudget, id: 'bud-0', month: 3 }
    vi.mocked(BudgetService.getAll).mockResolvedValue([existing])
    vi.mocked(BudgetService.create).mockResolvedValue(mockBudget)
    const store = useBudgetStore()
    await store.fetchAll()

    const result = await store.createBudget(2026, 4)

    expect(result?.id).toBe('bud-1')
    expect(store.budgets[0].id).toBe('bud-1') // Más reciente al inicio
    expect(store.budgets).toHaveLength(2)
  })

  it('createBudget — devuelve null y guarda error si el servicio falla', async () => {
    vi.mocked(BudgetService.create).mockRejectedValue({
      response: { data: { message: 'Ya existe un presupuesto para ese mes' } },
    })
    const store = useBudgetStore()

    const result = await store.createBudget(2026, 4)

    expect(result).toBeNull()
    expect(store.error).toBe('Ya existe un presupuesto para ese mes')
  })

  // ── addIncome ───────────────────────────────────────────────────────────────
  it('addIncome — agrega el ingreso al presupuesto activo', async () => {
    // addIncome llama a fetchOne tras guardar → el 2do fetch debe devolver el ingreso ya persistido
    vi.mocked(BudgetService.getOne)
      .mockResolvedValueOnce({ ...mockBudgetFull, incomes: [] })
      .mockResolvedValueOnce(mockBudgetFull)
    vi.mocked(BudgetService.addIncome).mockResolvedValue(mockIncome)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    await store.addIncome({ name: 'Salario', budgeted: 25000, actual: 25000 })

    expect(store.current?.incomes).toHaveLength(1)
    expect(store.current?.incomes[0].name).toBe('Salario')
  })

  // ── removeIncome ────────────────────────────────────────────────────────────
  it('removeIncome — elimina el ingreso por id', async () => {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    vi.mocked(BudgetService.deleteIncome).mockResolvedValue(undefined)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    await store.removeIncome('inc-1')

    expect(store.current?.incomes).toHaveLength(0)
  })

  // ── addTransaction ──────────────────────────────────────────────────────────
  it('addTransaction — inserta la transacción al inicio (más reciente primero)', async () => {
    // addTransaction llama a fetchOne tras guardar → el 2do fetch debe devolver la transacción ya persistida
    vi.mocked(BudgetService.getOne)
      .mockResolvedValueOnce({ ...mockBudgetFull, transactions: [] })
      .mockResolvedValueOnce(mockBudgetFull)
    vi.mocked(BudgetService.addTransaction).mockResolvedValue(mockTransaction)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    await store.addTransaction({
      amount: 500, category: 'food', paymentType: 'cash', note: 'Comida', date: '2026-04-01',
    })

    expect(store.current?.transactions[0].id).toBe('tx-1')
  })

  // ── toggleBillPaid ──────────────────────────────────────────────────────────
  it('toggleBillPaid — actualiza isPaid en la factura correcta', async () => {
    const billPagada: Bill = { ...mockBill, isPaid: true }
    // toggleBillPaid llama a fetchOne tras mutar → el 2do fetch debe devolver el bill ya pagado
    vi.mocked(BudgetService.getOne)
      .mockResolvedValueOnce(mockBudgetFull)
      .mockResolvedValueOnce({ ...mockBudgetFull, bills: [billPagada] })
    vi.mocked(BudgetService.markBillPaid).mockResolvedValue(billPagada)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    await store.toggleBillPaid('bill-1', true)

    expect(store.current?.bills[0].isPaid).toBe(true)
  })

  // ── clearCurrent ────────────────────────────────────────────────────────────
  it('clearCurrent — resetea current y summary', async () => {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    const store = useBudgetStore()
    await store.fetchOne('bud-1')

    store.clearCurrent()

    expect(store.current).toBeNull()
    expect(store.summary).toBeNull()
  })

  // ── _extractError ───────────────────────────────────────────────────────────
  it('extrae mensaje de error de respuesta Axios anidada', async () => {
    vi.mocked(BudgetService.getAll).mockRejectedValue({
      response: { data: { message: ['campo requerido', 'valor inválido'] } },
    })
    const store = useBudgetStore()

    await store.fetchAll()

    // Array de mensajes se une con coma
    expect(store.error).toBe('campo requerido, valor inválido')
  })
})

// ── Suite de guardas E2EE (Strict TDD — RED antes de GREEN) ───────────────────
describe('useBudgetStore — guardas de cifrado E2EE', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    toastErrorSpy.mockClear()
    // Por defecto crypto listo, canRestore=true, user presente
    mockIsReady.mockReturnValue(true)
    mockCanRestore.mockReturnValue(true)
    mockUser.mockReturnValue({ id: 'user-1' })
    mockDecrypt.mockImplementation((v: unknown) => Promise.resolve(typeof v === 'number' ? v : Number(v)))
    mockEncrypt.mockImplementation((v: unknown) => Promise.resolve(`enc:${v}`))
  })

  // ── Helpers internos de setup ─────────────────────────────────────────────

  // Carga el store con un presupuesto activo para que if (!budget.value) no corte
  async function loadBudget(store: ReturnType<typeof useBudgetStore>) {
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    await store.fetchOne('bud-1')
  }

  // ── RED-BS-01: addIncome aborta con MSG_CRYPTO_WRITE_BLOCKED cuando isReady=false y canRestore=true ──
  it('RED-BS-01: addIncome aborts with MSG_CRYPTO_WRITE_BLOCKED when isReady=false and canRestore=true', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    // Simula estado degradado recuperable
    mockIsReady.mockReturnValue(false)
    mockCanRestore.mockReturnValue(true)

    await store.addIncome({ name: 'Sueldo', budgeted: 10000 })

    // La guarda debe disparar toast con el mensaje de bloqueo recuperable
    expect(toastErrorSpy).toHaveBeenCalledOnce()
    expect(toastErrorSpy).toHaveBeenCalledWith(MSG_CRYPTO_WRITE_BLOCKED)
    // encrypt NO debe haberse llamado
    expect(mockEncrypt).not.toHaveBeenCalled()
    // BudgetService.addIncome NO debe haberse llamado
    expect(BudgetService.addIncome).not.toHaveBeenCalled()
  })

  // ── RED-BS-02: addIncome aborta con MSG_CRYPTO_WRITE_UNRECOVERABLE cuando canRestore=false ──
  it('RED-BS-02: addIncome aborts with MSG_CRYPTO_WRITE_UNRECOVERABLE when isReady=false and canRestore=false', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    mockIsReady.mockReturnValue(false)
    mockCanRestore.mockReturnValue(false)

    await store.addIncome({ name: 'Sueldo', budgeted: 10000 })

    expect(toastErrorSpy).toHaveBeenCalledOnce()
    expect(toastErrorSpy).toHaveBeenCalledWith(MSG_CRYPTO_WRITE_UNRECOVERABLE)
    expect(mockEncrypt).not.toHaveBeenCalled()
    expect(BudgetService.addIncome).not.toHaveBeenCalled()
  })

  // ── RED-BS-03: addBill aborta con toast cuando isReady=false ──────────────
  it('RED-BS-03: addBill aborts with toast when isReady=false', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    mockIsReady.mockReturnValue(false)
    mockCanRestore.mockReturnValue(true)

    await store.addBill({ name: 'Renta', budgeted: 8000, actual: 8000, dueDate: null, paymentType: null })

    expect(toastErrorSpy).toHaveBeenCalledOnce()
    expect(toastErrorSpy).toHaveBeenCalledWith(MSG_CRYPTO_WRITE_BLOCKED)
    expect(mockEncrypt).not.toHaveBeenCalled()
    expect(BudgetService.addBill).not.toHaveBeenCalled()
  })

  // ── RED-BS-04: addExpense aborta con toast cuando isReady=false ───────────
  it('RED-BS-04: addExpense aborts with toast when isReady=false', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    mockIsReady.mockReturnValue(false)
    mockCanRestore.mockReturnValue(true)

    await store.addExpense({ category: 'food', budgeted: 3000 })

    expect(toastErrorSpy).toHaveBeenCalledOnce()
    expect(toastErrorSpy).toHaveBeenCalledWith(MSG_CRYPTO_WRITE_BLOCKED)
    expect(mockEncrypt).not.toHaveBeenCalled()
    expect(BudgetService.addExpense).not.toHaveBeenCalled()
  })

  // ── RED-BS-05: addTransaction aborta con toast cuando isReady=false ───────
  it('RED-BS-05: addTransaction aborts with toast when isReady=false', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    mockIsReady.mockReturnValue(false)
    mockCanRestore.mockReturnValue(true)

    await store.addTransaction({ amount: 500, category: 'food', paymentType: null, note: null, date: '2026-04-01' })

    expect(toastErrorSpy).toHaveBeenCalledOnce()
    expect(toastErrorSpy).toHaveBeenCalledWith(MSG_CRYPTO_WRITE_BLOCKED)
    expect(mockEncrypt).not.toHaveBeenCalled()
    expect(BudgetService.addTransaction).not.toHaveBeenCalled()
  })

  // ── RED-BS-06: toggleBillPaid aborta en entry cuando isReady=false — fetchOne NO se dispara ──
  it('RED-BS-06: toggleBillPaid aborts at entry when isReady=false, fetchOne is NOT triggered', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    mockIsReady.mockReturnValue(false)
    mockCanRestore.mockReturnValue(true)

    // Limpiamos el mock de getOne para poder afirmar que NO se llamó de nuevo
    vi.mocked(BudgetService.getOne).mockClear()

    await store.toggleBillPaid('bill-1', true)

    expect(toastErrorSpy).toHaveBeenCalledOnce()
    expect(toastErrorSpy).toHaveBeenCalledWith(MSG_CRYPTO_WRITE_BLOCKED)
    // fetchOne nunca debería llamar al servicio si la guarda corta primero
    expect(BudgetService.markBillPaid).not.toHaveBeenCalled()
    expect(BudgetService.getOne).not.toHaveBeenCalled()
  })

  // ── RED-BS-07: toggleBillPaid procede y llama markBillPaid cuando isReady=true ──
  it('RED-BS-07: toggleBillPaid proceeds and calls markBillPaid when isReady=true', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    mockIsReady.mockReturnValue(true)
    const billPagada: Bill = { ...mockBill, isPaid: true }
    vi.mocked(BudgetService.markBillPaid).mockResolvedValue(billPagada)
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)

    await store.toggleBillPaid('bill-1', true)

    expect(BudgetService.markBillPaid).toHaveBeenCalled()
    expect(toastErrorSpy).not.toHaveBeenCalled()
  })

  // ── RED-BS-08: fetchOne setea degraded=true y error cuando isReady=false ──
  it('RED-BS-08: fetchOne sets degraded=true and error when isReady=false', async () => {
    const store = useBudgetStore()
    mockIsReady.mockReturnValue(false)

    await store.fetchOne('bud-1')

    // La guarda debe setear degraded y error sin llamar al servicio
    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
    expect(store.error).toBe(MSG_CRYPTO_READ_BLOCKED)
    expect(BudgetService.getOne).not.toHaveBeenCalled()
  })

  // ── RED-BS-09: fetchOne resetea degraded=false al completar exitosamente ──
  it('RED-BS-09: fetchOne clears degraded=false on successful completion when isReady=true', async () => {
    const store = useBudgetStore()

    // Primera llamada con crypto degradado para setear degraded=true
    mockIsReady.mockReturnValue(false)
    await store.fetchOne('bud-1')
    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)

    // Segunda llamada con crypto listo — debe resetear degraded a false
    mockIsReady.mockReturnValue(true)
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)
    await store.fetchOne('bud-1')

    expect((store as unknown as { degraded: boolean }).degraded).toBe(false)
  })

  // ── RED-BS-10: fetchOne setea degraded=true cuando decryptIncome lanza ────
  it('RED-BS-10: fetchOne sets degraded=true when decryptIncome throws during processing', async () => {
    const store = useBudgetStore()
    mockIsReady.mockReturnValue(true)

    // Simula error de descifrado dentro de decryptIncome
    mockDecrypt.mockRejectedValueOnce(new Error('Decrypt failed'))
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)

    await store.fetchOne('bud-1')

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
  })

  // ── RED-BS-11: fetchOne setea degraded=true cuando decryptBill lanza ──────
  it('RED-BS-11: fetchOne sets degraded=true when decryptBill throws', async () => {
    const store = useBudgetStore()
    mockIsReady.mockReturnValue(true)

    // Primera llamada (Income) pasa, segunda (Bill) falla
    mockDecrypt
      .mockResolvedValueOnce(25000)  // Income.budgeted
      .mockResolvedValueOnce(25000)  // Income.actual
      .mockRejectedValueOnce(new Error('Bill decrypt failed'))

    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)

    await store.fetchOne('bud-1')

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
  })

  // ── RED-BS-12: fetchOne setea degraded=true cuando decryptExpense lanza ───
  it('RED-BS-12: fetchOne sets degraded=true when decryptExpense throws', async () => {
    const store = useBudgetStore()
    mockIsReady.mockReturnValue(true)

    // Forzamos el error después de pasar Income y Bill
    mockDecrypt.mockRejectedValue(new Error('Expense decrypt failed'))
    vi.mocked(BudgetService.getOne).mockResolvedValue({
      ...mockBudgetFull,
      incomes:  [],
      bills:    [],
      expenses: [{ id: 'exp-1', budgetId: 'bud-1', category: 'food', budgeted: 'enc:3000', actual: null }],
    } as unknown as BudgetFull)

    await store.fetchOne('bud-1')

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
  })

  // ── RED-BS-13: fetchOne setea degraded=true cuando decryptTransaction lanza ──
  it('RED-BS-13: fetchOne sets degraded=true when decryptTransaction throws', async () => {
    const store = useBudgetStore()
    mockIsReady.mockReturnValue(true)

    mockDecrypt.mockRejectedValue(new Error('Transaction decrypt failed'))
    vi.mocked(BudgetService.getOne).mockResolvedValue({
      ...mockBudgetFull,
      incomes:      [],
      bills:        [],
      expenses:     [],
      transactions: [{ id: 'tx-1', budgetId: 'bud-1', amount: 'enc:500', category: 'food', paymentType: null, note: null, date: '2026-04-01' }],
    } as unknown as BudgetFull)

    await store.fetchOne('bud-1')

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
  })

  // ── RED-BS-14: addIncome con isReady=true procede normalmente ────────────
  it('RED-BS-14: addIncome with isReady=true proceeds normally, toast.error NOT called', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    mockIsReady.mockReturnValue(true)
    vi.mocked(BudgetService.addIncome).mockResolvedValue(mockIncome)
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)

    await store.addIncome({ name: 'Sueldo', budgeted: 10000 })

    expect(mockEncrypt).toHaveBeenCalled()
    expect(BudgetService.addIncome).toHaveBeenCalled()
    expect(toastErrorSpy).not.toHaveBeenCalled()
  })

  // ── RED-BS-15: addBill con isReady=true procede normalmente ──────────────
  it('RED-BS-15: addBill with isReady=true proceeds normally, no guard fires', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    mockIsReady.mockReturnValue(true)
    vi.mocked(BudgetService.addBill).mockResolvedValue(mockBill)
    vi.mocked(BudgetService.getOne).mockResolvedValue(mockBudgetFull)

    await store.addBill({ name: 'Renta', budgeted: 8000, actual: 8000, dueDate: null, paymentType: null })

    expect(BudgetService.addBill).toHaveBeenCalled()
    expect(toastErrorSpy).not.toHaveBeenCalled()
  })

  // ── removeTransaction ───────────────────────────────────────────────────────

  it('removeTransaction — elimina la transacción de la lista local', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    vi.mocked(BudgetService.deleteTransaction).mockResolvedValue(undefined)

    await store.removeTransaction('tx-1')

    expect(BudgetService.deleteTransaction).toHaveBeenCalledWith('bud-1', 'tx-1')
  })

  it('removeTransaction — no hace nada si no hay budget activo', async () => {
    const store = useBudgetStore()
    await store.removeTransaction('tx-x')
    expect(BudgetService.deleteTransaction).not.toHaveBeenCalled()
  })

  it('removeTransaction — lanza error si la petición falla', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    vi.mocked(BudgetService.deleteTransaction).mockRejectedValue({ response: { data: { message: 'Error' } } })

    await expect(store.removeTransaction('tx-1')).rejects.toBeDefined()
  })

  // ── clearCurrent ─────────────────────────────────────────────────────────

  it('clearCurrent — resetea budget, incomes, bills, expenses y transactions', async () => {
    const store = useBudgetStore()
    await loadBudget(store)

    expect(store.current).not.toBeNull()

    store.clearCurrent()

    expect(store.current).toBeNull()
    expect(store.totalIngresos).toBe(0)
    expect(store.totalGastado).toBe(0)
    expect(store.disponible).toBe(0)
  })
})
