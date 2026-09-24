import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

// ── Mocks ────────────────────────────────────────────────────────────────────

const fetchAllMock       = vi.fn()
const createGoalMock     = vi.fn()
const updateGoalMock     = vi.fn()
const deleteGoalMock     = vi.fn()
const addContributionMock = vi.fn()

const savingsStoreMock = {
  goals:    [] as any[],
  loading:  false,
  error:    null as string | null,
  fetchAll:        fetchAllMock,
  createGoal:      createGoalMock,
  updateGoal:      updateGoalMock,
  deleteGoal:      deleteGoalMock,
  addContribution: addContributionMock,
}

vi.mock('@/stores/savings.store', () => ({
  useSavingsStore: () => savingsStoreMock,
}))

vi.mock('@/components', () => ({
  AppButton:     { template: '<button @click="$emit(\'click\')"><slot /></button>', emits: ['click'] },
  AppBadge:      { template: '<span><slot /></span>' },
  AppModal:      { template: '<div><slot /><slot name="actions" /></div>' },
  AppAlert:      { template: '<div><slot /></div>' },
  AppSkeleton:   { template: '<div />' },
  AppHelpDrawer: { template: '<div />' },
}))

import SavingsView from '@/views/savings/SavingsView.vue'
import type { SavingGoal } from '@/types/savings.types'

const mkGoal = (overrides: Partial<SavingGoal> = {}): SavingGoal => ({
  id: 'g-1', name: 'Fondo emergencias', targetAmount: 50000, currentAmount: 10000,
  targetDate: null, frequency: 'mensual', minimumMonthlyContribution: 2000,
  isCompleted: false, notes: null, createdAt: '2026-01-01',
  ...overrides,
})

describe('SavingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    savingsStoreMock.goals   = []
    savingsStoreMock.loading = false
    savingsStoreMock.error   = null
    fetchAllMock.mockResolvedValue(undefined)
  })

  it('llama fetchAll en onMounted', async () => {
    shallowMount(SavingsView)
    await new Promise(r => setTimeout(r, 0))
    expect(fetchAllMock).toHaveBeenCalledTimes(1)
  })

  it('fmt formatea como moneda MXN', () => {
    const vm = (shallowMount(SavingsView) as any).vm
    expect(vm.fmt(10000)).toContain('10,000')
  })

  it('goalProgress devuelve 0 si targetAmount es 0', () => {
    const vm = (shallowMount(SavingsView) as any).vm
    const goal = mkGoal({ targetAmount: 0 })
    expect(vm.goalProgress(goal)).toBe(0)
  })

  it('goalProgress calcula el porcentaje correctamente', () => {
    const vm = (shallowMount(SavingsView) as any).vm
    const goal = mkGoal({ currentAmount: 25000, targetAmount: 50000 })
    expect(vm.goalProgress(goal)).toBe(50)
  })

  it('goalProgress devuelve máximo 100 aunque currentAmount > targetAmount', () => {
    const vm = (shallowMount(SavingsView) as any).vm
    const goal = mkGoal({ currentAmount: 60000, targetAmount: 50000 })
    expect(vm.goalProgress(goal)).toBe(100)
  })

  it('goalsWithProjection devuelve array con goal y projection', () => {
    savingsStoreMock.goals = [mkGoal()]
    const vm = (shallowMount(SavingsView) as any).vm
    expect(vm.goalsWithProjection).toHaveLength(1)
    expect(vm.goalsWithProjection[0].goal).toBeDefined()
    expect(vm.goalsWithProjection[0].projection).toBeDefined()
  })

  it('openCreate inicializa el form vacío y muestra el modal', () => {
    const vm = (shallowMount(SavingsView) as any).vm
    vm.openCreate()
    expect(vm.showGoalModal).toBe(true)
    expect(vm.editingGoal).toBeNull()
    expect(vm.goalForm.name).toBe('')
  })

  it('openEdit carga los datos de la meta y muestra el modal', () => {
    const goal = mkGoal({ name: 'Vacaciones', targetAmount: 30000 })
    const vm = (shallowMount(SavingsView) as any).vm
    vm.openEdit(goal)
    expect(vm.showGoalModal).toBe(true)
    expect(vm.editingGoal).toEqual(goal)
    expect(vm.goalForm.name).toBe('Vacaciones')
    expect(vm.goalForm.targetAmount).toBe(30000)
  })

  it('submitGoal setea goalError si el nombre está vacío', async () => {
    const vm = (shallowMount(SavingsView) as any).vm
    vm.goalForm.name = ''
    await vm.submitGoal()
    expect(vm.goalError).toBeTruthy()
    expect(createGoalMock).not.toHaveBeenCalled()
  })

  it('submitGoal setea goalError si targetAmount es 0', async () => {
    const vm = (shallowMount(SavingsView) as any).vm
    vm.goalForm.name         = 'Vacaciones'
    vm.goalForm.targetAmount = 0
    await vm.submitGoal()
    expect(vm.goalError).toBeTruthy()
    expect(createGoalMock).not.toHaveBeenCalled()
  })

  it('submitGoal llama a createGoal cuando no hay editingGoal', async () => {
    createGoalMock.mockResolvedValue(mkGoal())
    const vm = (shallowMount(SavingsView) as any).vm
    vm.goalForm.name         = 'Vacaciones'
    vm.goalForm.targetAmount = 30000
    await vm.submitGoal()
    expect(createGoalMock).toHaveBeenCalledTimes(1)
    expect(vm.showGoalModal).toBe(false)
  })

  it('submitGoal llama a updateGoal cuando hay editingGoal', async () => {
    updateGoalMock.mockResolvedValue(mkGoal())
    const vm = (shallowMount(SavingsView) as any).vm
    // Abrir en modo edición via el flujo real
    const goal = mkGoal()
    vm.openEdit(goal)
    vm.goalForm.name         = 'Nuevo nombre'
    vm.goalForm.targetAmount = 60000
    await vm.submitGoal()
    expect(updateGoalMock).toHaveBeenCalledTimes(1)
    expect(vm.showGoalModal).toBe(false)
  })

  it('openContrib inicializa el form y muestra el modal', () => {
    const goal = mkGoal({ minimumMonthlyContribution: 2000 })
    const vm = (shallowMount(SavingsView) as any).vm
    vm.openContrib(goal)
    expect(vm.showContribModal).toBe(true)
    expect(vm.contribTarget).toEqual(goal)
    expect(vm.contribForm.amount).toBe(2000)
  })

  it('submitContrib setea contribError si el monto es 0', async () => {
    const vm = (shallowMount(SavingsView) as any).vm
    vm.contribForm.amount = 0
    await vm.submitContrib()
    expect(vm.contribError).toBeTruthy()
    expect(addContributionMock).not.toHaveBeenCalled()
  })

  it('submitContrib no hace nada si no hay contribTarget', async () => {
    const vm = (shallowMount(SavingsView) as any).vm
    vm.contribTarget  = null
    vm.contribForm.amount = 1000
    await vm.submitContrib()
    expect(addContributionMock).not.toHaveBeenCalled()
  })

  it('submitContrib llama a addContribution y cierra el modal', async () => {
    addContributionMock.mockResolvedValue(undefined)
    const goal = mkGoal()
    const vm = (shallowMount(SavingsView) as any).vm
    vm.openContrib(goal)
    vm.contribForm.amount = 2000
    await vm.submitContrib()
    expect(addContributionMock).toHaveBeenCalledWith('g-1', expect.objectContaining({ amount: 2000 }))
    expect(vm.showContribModal).toBe(false)
  })

  it('confirmDelete abre el modal de eliminación con la meta correcta', () => {
    const goal = mkGoal()
    const vm = (shallowMount(SavingsView) as any).vm
    vm.confirmDelete(goal)
    expect(vm.deleteModalOpen).toBe(true)
    expect(vm.deleteTarget).toEqual(goal)
  })

  it('onDeleteModalClose limpia deleteTarget si val es false', () => {
    const vm = (shallowMount(SavingsView) as any).vm
    vm.deleteTarget = mkGoal()
    vm.onDeleteModalClose(false)
    expect(vm.deleteTarget).toBeNull()
  })

  it('executeDelete no hace nada si no hay deleteTarget', async () => {
    const vm = (shallowMount(SavingsView) as any).vm
    vm.deleteTarget = null
    await vm.executeDelete()
    expect(deleteGoalMock).not.toHaveBeenCalled()
  })

  it('executeDelete llama a deleteGoal y cierra el modal', async () => {
    deleteGoalMock.mockResolvedValue(undefined)
    const goal = mkGoal()
    const vm = (shallowMount(SavingsView) as any).vm
    vm.confirmDelete(goal)
    await vm.executeDelete()
    expect(deleteGoalMock).toHaveBeenCalledWith('g-1')
    expect(vm.deleteModalOpen).toBe(false)
  })
})
