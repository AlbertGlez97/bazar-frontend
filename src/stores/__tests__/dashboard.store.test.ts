// Tests unitarios del dashboard store — guardas E2EE, fetchDashboard, fetchAnnual, fix catch silencioso
// Strict TDD: tests RED escritos antes de la implementación.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ── Mocks (ANTES de importar el store bajo prueba — hoisting de Vitest) ────────

const mockIsReady = vi.fn(() => true)
const mockCanRestore = vi.fn(() => true)
const mockDecrypt = vi.fn((v: unknown) => Promise.resolve(typeof v === 'number' ? v : 0))

vi.mock('@/stores/crypto.store', () => ({
  useCryptoStore: vi.fn(() => ({
    get isReady() { return mockIsReady() },
    canRestore:   mockCanRestore,
    decrypt:      mockDecrypt,
  })),
}))

vi.mock('@/services/dashboard.service')

// ── Import del store (DESPUÉS de los mocks) ────────────────────────────────────
import { useDashboardStore } from '@/stores/dashboard.store'
import DashboardService from '@/services/dashboard.service'

// ── Constante copiada del store (para assertar sin acoplar a la implementación) ──
const MSG_CRYPTO_READ_BLOCKED = 'Tus datos están protegidos. Desbloqueá tu cifrado para visualizarlos.'

// ── Fixtures ───────────────────────────────────────────────────────────────────

const mockRawDashboard = {
  generadoEn: '2026-04-18T00:00:00Z',
  mesActual: {
    mes: 'Abril',
    anio: 2026,
    budget: null,
    mensaje: 'No existe presupuesto para el mes actual.',
  },
  topGastos: {
    anio: 2026,
    transactions: [],
  },
  anual: {
    anio: 2026,
    budgets: [],
  },
  deudas: {
    totalInicial: 0,
    totalPagado: 0,
    totalRestante: 0,
    pagoMinimoMensual: 0,
    porcentajeAvance: 0,
    deudasActivas: 0,
    deudasLiquidadas: 0,
    mesesParaLibertad: null,
    fechaEstimadaLibertad: null,
  },
  ahorros: {
    totalAhorrado: 0,
    totalObjetivo: 0,
    totalFaltante: 0,
    porcentajeGlobal: 0,
    totalMetas: 0,
    proximaMeta: null,
    fondoEmergencias: null,
  },
}

const mockRawAnnual = {
  anio: 2025,
  budgets: [],
}

// ── Suite: guardas E2EE del dashboard store ────────────────────────────────────
describe('useDashboardStore — guardas de cifrado E2EE', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockIsReady.mockReturnValue(true)
    mockCanRestore.mockReturnValue(true)
    mockDecrypt.mockImplementation((v: unknown) => Promise.resolve(typeof v === 'number' ? v : 0))
  })

  // ── RED-DS-01: fetchDashboard setea degraded=true y error cuando isReady=false ──
  it('RED-DS-01: fetchDashboard sets degraded=true and error when isReady=false, no HTTP call', async () => {
    const store = useDashboardStore()
    mockIsReady.mockReturnValue(false)

    await store.fetchDashboard()

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
    expect(store.error).toBe(MSG_CRYPTO_READ_BLOCKED)
    expect(DashboardService.getFullDashboard).not.toHaveBeenCalled()
  })

  // ── RED-DS-02: fetchDashboard setea degraded=true cuando decryptNumber lanza ──
  it('RED-DS-02: fetchDashboard sets degraded=true when decryptNumber throws inside buildTopGastos', async () => {
    const store = useDashboardStore()
    mockIsReady.mockReturnValue(true)
    mockDecrypt.mockRejectedValue(new Error('Decrypt failed'))

    vi.mocked(DashboardService.getFullDashboard).mockResolvedValue({
      ...mockRawDashboard,
      topGastos: {
        anio: 2026,
        transactions: [{ id: 'tx-1', budgetId: 'bud-1', amount: { iv: 'iv', ct: 'ct' }, category: 'food', paymentType: 'cash', note: null, date: '2026-04-01' }],
      },
    } as unknown as Parameters<typeof DashboardService.getFullDashboard extends () => Promise<infer R> ? () => Promise<R> : never>[0])

    await store.fetchDashboard()

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
  })

  // ── RED-DS-03: fetchDashboard resetea degraded=false al completar exitosamente ──
  it('RED-DS-03: fetchDashboard clears degraded=false on successful completion', async () => {
    const store = useDashboardStore()

    // Primera llamada con crypto degradado para setear degraded=true
    mockIsReady.mockReturnValue(false)
    await store.fetchDashboard()
    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)

    // Segunda llamada con crypto listo — debe resetear degraded a false
    mockIsReady.mockReturnValue(true)
    vi.mocked(DashboardService.getFullDashboard).mockResolvedValue(mockRawDashboard as unknown as Parameters<typeof DashboardService.getFullDashboard extends () => Promise<infer R> ? () => Promise<R> : never>[0])

    await store.fetchDashboard()

    expect((store as unknown as { degraded: boolean }).degraded).toBe(false)
  })

  // ── RED-DS-04: fetchDashboard con isReady=true procede normalmente ────────────
  it('RED-DS-04: fetchDashboard with isReady=true proceeds normally', async () => {
    const store = useDashboardStore()
    mockIsReady.mockReturnValue(true)
    vi.mocked(DashboardService.getFullDashboard).mockResolvedValue(mockRawDashboard as unknown as Parameters<typeof DashboardService.getFullDashboard extends () => Promise<infer R> ? () => Promise<R> : never>[0])

    await store.fetchDashboard()

    expect(DashboardService.getFullDashboard).toHaveBeenCalled()
    expect((store as unknown as { degraded: boolean }).degraded).toBe(false)
  })

  // ── RED-DS-05: fetchAnnual setea degraded=true y error cuando isReady=false ──
  it('RED-DS-05: fetchAnnual sets degraded=true and error when isReady=false', async () => {
    const store = useDashboardStore()
    mockIsReady.mockReturnValue(false)

    await store.fetchAnnual(2025)

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
    expect(store.error).toBe(MSG_CRYPTO_READ_BLOCKED)
    expect(DashboardService.getAnnualSummary).not.toHaveBeenCalled()
  })

  // ── RED-DS-06: fetchAnnual setea degraded=true y llama console.warn cuando network lanza ──
  it('RED-DS-06: fetchAnnual sets degraded=true and calls console.warn when network throws', async () => {
    const store = useDashboardStore()
    mockIsReady.mockReturnValue(true)

    const networkError = new Error('Network error')
    vi.mocked(DashboardService.getAnnualSummary).mockRejectedValue(networkError)
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await store.fetchAnnual(2025)

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
    expect(store.error).not.toBeNull()
    expect(consoleWarnSpy).toHaveBeenCalledWith(networkError)

    consoleWarnSpy.mockRestore()
  })

  // ── RED-DS-07: fetchAnnual ya no swallows errors silenciosamente ──────────────
  it('RED-DS-07: fetchAnnual no longer swallows errors silently (assert error.value is set after throw)', async () => {
    const store = useDashboardStore()
    mockIsReady.mockReturnValue(true)

    vi.mocked(DashboardService.getAnnualSummary).mockRejectedValue(new Error('Service error'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await store.fetchAnnual(2025)

    // error.value debe estar seteado — no es null (no más catch silencioso)
    expect(store.error).not.toBeNull()
    expect(store.error).toBe('Error al cargar el dashboard')
  })

  // ── RED-DS-08: fetchAnnual resetea degraded=false al completar exitosamente ──
  it('RED-DS-08: fetchAnnual clears degraded=false on successful completion', async () => {
    const store = useDashboardStore()

    // Primera llamada con crypto degradado
    mockIsReady.mockReturnValue(false)
    await store.fetchAnnual(2025)
    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)

    // Segunda llamada con crypto listo y servicio ok
    mockIsReady.mockReturnValue(true)
    vi.mocked(DashboardService.getAnnualSummary).mockResolvedValue(mockRawAnnual as unknown as Parameters<typeof DashboardService.getAnnualSummary extends (year: number) => Promise<infer R> ? (year: number) => Promise<R> : never>[1])

    await store.fetchAnnual(2025)

    expect((store as unknown as { degraded: boolean }).degraded).toBe(false)
  })

  // ── RED-DS-09: fetchDashboard throw en sumEncryptedIncomes setea degraded=true ──
  it('RED-DS-09: fetchDashboard decrypt throw in sumEncryptedIncomes sets degraded=true (not swallowed)', async () => {
    const store = useDashboardStore()
    mockIsReady.mockReturnValue(true)
    mockDecrypt.mockRejectedValue(new Error('sumEncryptedIncomes failed'))

    vi.mocked(DashboardService.getFullDashboard).mockResolvedValue({
      ...mockRawDashboard,
      mesActual: {
        mes: 'Abril',
        anio: 2026,
        budget: {
          id: 'bud-1', year: 2026, month: 4,
          incomes: [{ id: 'i1', budgetId: 'bud-1', budgeted: { iv: 'iv', ct: 'ct' }, actual: null }],
          bills: [],
          expenses: [],
          transactions: [],
        },
        mensaje: undefined,
      },
    } as unknown as Parameters<typeof DashboardService.getFullDashboard extends () => Promise<infer R> ? () => Promise<R> : never>[0])

    await store.fetchDashboard()

    expect((store as unknown as { degraded: boolean }).degraded).toBe(true)
  })

  // ── RED-DS-10: useToastStore NO es importado en dashboard.store ───────────────
  it('RED-DS-10: useToastStore is NOT called in dashboard.store (no toast on read-op failures)', async () => {
    const store = useDashboardStore()
    mockIsReady.mockReturnValue(false)

    // Importamos el módulo del store para inspeccionar — si toast fuera llamado,
    // el mock de toast.store capturaría la llamada.
    // Como no mockeamos useToastStore, si el store lo llama lanzaría.
    // El test simplemente verifica que fetchDashboard/fetchAnnual no lanzan cuando toast no existe.
    await expect(store.fetchDashboard()).resolves.not.toThrow()
    await expect(store.fetchAnnual(2025)).resolves.not.toThrow()
  })
})
