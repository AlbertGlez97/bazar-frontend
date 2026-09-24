// Tests unitarios del store de ahorros — cubre CRUD y contribuciones
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSavingsStore } from '@/stores/savings.store'
import SavingsService from '@/services/savings.service'
import type { SavingGoal, SavingContribution } from '@/types/savings.types'

// ── Mocks de servicio ──────────────────────────────────────────────────────────
vi.mock('@/services/savings.service')
vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    success: vi.fn(),
    error:   vi.fn(),
  }),
}))

// ── Fixtures ───────────────────────────────────────────────────────────────────
const mockGoal: SavingGoal = {
  id:            'goal-1',
  name:          'Fondo de emergencia',
  targetAmount:  50000,
  currentAmount: 12000,
  targetDate:    '2026-12-31',
  isCompleted:   false,
  createdAt:     '2026-01-01T00:00:00Z',
}

const mockContrib: SavingContribution = {
  id:         'contrib-1',
  goalId:     'goal-1',
  amount:     1000,
  date:       '2026-04-01',
  note:       'Quincena',
}

// ── Suite principal ────────────────────────────────────────────────────────────
describe('useSavingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── Estado inicial ──────────────────────────────────────────────────────────
  it('inicia con estado vacío', () => {
    const store = useSavingsStore()
    expect(store.goals).toEqual([])
    expect(store.current).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  // ── fetchAll ────────────────────────────────────────────────────────────────
  it('fetchAll — carga la lista de metas correctamente', async () => {
    vi.mocked(SavingsService.getAll).mockResolvedValue([mockGoal])
    const store = useSavingsStore()

    await store.fetchAll()

    expect(store.goals).toHaveLength(1)
    expect(store.goals[0].name).toBe('Fondo de emergencia')
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('fetchAll — captura errores y los almacena en error', async () => {
    vi.mocked(SavingsService.getAll).mockRejectedValue(new Error('Network error'))
    const store = useSavingsStore()

    await store.fetchAll()

    expect(store.goals).toEqual([])
    expect(store.error).toBe('Network error')
    expect(store.loading).toBe(false)
  })

  // ── fetchOne ────────────────────────────────────────────────────────────────
  it('fetchOne — carga meta y contribuciones en paralelo', async () => {
    vi.mocked(SavingsService.getOne).mockResolvedValue(mockGoal)
    vi.mocked(SavingsService.getContributions).mockResolvedValue([mockContrib])
    const store = useSavingsStore()

    await store.fetchOne('goal-1')

    expect(store.current?.id).toBe('goal-1')
    expect(store.contributions).toHaveLength(1)
    expect(store.contributions[0].id).toBe('contrib-1')
  })

  // ── createGoal ──────────────────────────────────────────────────────────────
  it('createGoal — agrega la nueva meta al inicio de la lista', async () => {
    const existing: SavingGoal = { ...mockGoal, id: 'goal-0', name: 'Viaje' }
    vi.mocked(SavingsService.getAll).mockResolvedValue([existing])
    vi.mocked(SavingsService.create).mockResolvedValue(mockGoal)
    const store = useSavingsStore()
    await store.fetchAll()

    const result = await store.createGoal({
      name: 'Fondo de emergencia',
      targetAmount: 50000,
      targetDate:   '2026-12-31',
    })

    expect(result?.id).toBe('goal-1')
    // La nueva meta debe estar al inicio
    expect(store.goals[0].id).toBe('goal-1')
    expect(store.goals).toHaveLength(2)
  })

  // ── updateGoal ──────────────────────────────────────────────────────────────
  it('updateGoal — actualiza la meta en lista y en current', async () => {
    const updated = { ...mockGoal, name: 'Fondo de emergencia 2.0' }
    vi.mocked(SavingsService.getAll).mockResolvedValue([mockGoal])
    vi.mocked(SavingsService.update).mockResolvedValue(updated)
    const store = useSavingsStore()
    await store.fetchAll()
    store.current = mockGoal

    await store.updateGoal('goal-1', { name: 'Fondo de emergencia 2.0' })

    expect(store.goals[0].name).toBe('Fondo de emergencia 2.0')
    expect(store.current?.name).toBe('Fondo de emergencia 2.0')
  })

  // ── deleteGoal ──────────────────────────────────────────────────────────────
  it('deleteGoal — elimina la meta de la lista y limpia current', async () => {
    vi.mocked(SavingsService.getAll).mockResolvedValue([mockGoal])
    vi.mocked(SavingsService.remove).mockResolvedValue(undefined)
    const store = useSavingsStore()
    await store.fetchAll()
    store.current = mockGoal

    await store.deleteGoal('goal-1')

    expect(store.goals).toHaveLength(0)
    expect(store.current).toBeNull()
  })

  // ── addContribution ─────────────────────────────────────────────────────────
  it('addContribution — actualiza currentAmount localmente y agrega la contribución al inicio', async () => {
    vi.mocked(SavingsService.getAll).mockResolvedValue([mockGoal])
    vi.mocked(SavingsService.addContribution).mockResolvedValue(mockContrib)
    const store = useSavingsStore()
    await store.fetchAll()
    store.current = mockGoal

    await store.addContribution('goal-1', { amount: 1000, date: '2026-04-01', note: 'Quincena' })

    expect(store.contributions[0].id).toBe('contrib-1')
    // currentAmount = 12000 (inicial) + 1000 (aporte) = 13000, computado localmente
    expect(store.current?.currentAmount).toBe(13000)
    expect(store.goals[0].currentAmount).toBe(13000)
  })

  // ── clearCurrent ────────────────────────────────────────────────────────────
  it('clearCurrent — limpia current y contributions', async () => {
    const store = useSavingsStore()
    store.current       = mockGoal
    store.contributions = [mockContrib]

    store.clearCurrent()

    expect(store.current).toBeNull()
    expect(store.contributions).toEqual([])
  })
})
