import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const fetchAllMock  = vi.fn()
const createBudgetMock = vi.fn()
const budgetStoreMock = {
  budgets: [] as any[],
  loading: false,
  error:   null as string | null,
  fetchAll:     fetchAllMock,
  createBudget: createBudgetMock,
}

vi.mock('@/stores/budget.store', () => ({
  useBudgetStore: () => budgetStoreMock,
}))

vi.mock('@/components', () => ({
  AppButton:     { template: '<button @click="$emit(\'click\')"><slot /></button>', emits: ['click'] },
  AppBadge:      { template: '<span><slot /></span>' },
  AppModal:      { template: '<div><slot /><slot name="actions" /></div>' },
  AppAlert:      { template: '<div><slot /></div>' },
  AppSkeleton:   { template: '<div />' },
  AppHelpDrawer: { template: '<div />' },
}))

import BudgetListView from '@/views/budget/BudgetListView.vue'

describe('BudgetListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    budgetStoreMock.budgets = []
    budgetStoreMock.loading = false
    budgetStoreMock.error   = null
  })

  it('se monta y llama fetchAll en onMounted', async () => {
    shallowMount(BudgetListView)
    await new Promise(r => setTimeout(r, 0))
    expect(fetchAllMock).toHaveBeenCalledTimes(1)
  })

  it('changeYear incrementa el año seleccionado', () => {
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    const currentYear = new Date().getFullYear()
    expect(vm.selectedYear).toBe(currentYear)
    vm.changeYear(1)
    expect(vm.selectedYear).toBe(currentYear + 1)
    vm.changeYear(-1)
    expect(vm.selectedYear).toBe(currentYear)
  })

  it('yearOptions incluye los últimos 6 años', () => {
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    expect(vm.yearOptions).toHaveLength(6)
    expect(vm.yearOptions[0]).toBe(new Date().getFullYear())
  })

  it('mesesDelAnio devuelve 12 meses', () => {
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    expect(vm.mesesDelAnio).toHaveLength(12)
  })

  it('mesesDelAnio vincula el budget al mes correcto', () => {
    const currentYear = new Date().getFullYear()
    budgetStoreMock.budgets = [{ id: 'b-1', year: currentYear, month: 1, totalIncome: 0, createdAt: '' }]
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    const enero = vm.mesesDelAnio[0]
    expect(enero.budget?.id).toBe('b-1')
  })

  it('goToBudget navega a BudgetDetail con el id', () => {
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    vm.goToBudget('b-1')
    expect(pushMock).toHaveBeenCalledWith({ name: 'BudgetDetail', params: { id: 'b-1' } })
  })

  it('fmt formatea número como moneda MXN', () => {
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    expect(vm.fmt(1000)).toContain('1,000')
  })

  it('openCreateModal muestra el modal', () => {
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    expect(vm.showCreateModal).toBe(false)
    vm.openCreateModal()
    expect(vm.showCreateModal).toBe(true)
  })

  it('closeCreateModal oculta el modal', () => {
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    vm.openCreateModal()
    vm.closeCreateModal()
    expect(vm.showCreateModal).toBe(false)
  })

  it('createForMonth setea el form con el mes indicado', () => {
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    vm.createForMonth(7)
    expect(vm.form.month).toBe(7)
    expect(vm.showCreateModal).toBe(true)
  })

  it('submitCreate llama a createBudget y navega al nuevo budget', async () => {
    createBudgetMock.mockResolvedValue({ id: 'b-new' })
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    await vm.submitCreate()
    expect(createBudgetMock).toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith({ name: 'BudgetDetail', params: { id: 'b-new' } })
  })

  it('submitCreate setea createError si createBudget devuelve null', async () => {
    createBudgetMock.mockResolvedValue(null)
    budgetStoreMock.error = 'Ya existe un presupuesto para ese mes'
    const wrapper = shallowMount(BudgetListView)
    const vm = wrapper.vm as any
    await vm.submitCreate()
    expect(vm.createError).toBe('Ya existe un presupuesto para ese mes')
  })
})
