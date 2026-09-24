import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

const fetchAllMock     = vi.fn()
const fetchAllPlansMock = vi.fn()
const createDebtMock   = vi.fn()
const updateDebtMock   = vi.fn()
const removeDebtMock   = vi.fn()
const clearPlansMock   = vi.fn()

const debtsStoreMock = {
  debts:         [] as any[],
  activeDebts:   [] as any[],
  loading:       false,
  error:         null as string | null,
  planSnowball:  null,
  planAvalanche: null,
  planFireball:  null,
  fetchAll:       fetchAllMock,
  fetchAllPlans:  fetchAllPlansMock,
  createDebt:     createDebtMock,
  updateDebt:     updateDebtMock,
  removeDebt:     removeDebtMock,
  clearPlans:     clearPlansMock,
}

vi.mock('@/stores/debts.store', () => ({
  useDebtsStore: () => debtsStoreMock,
}))

vi.mock('@/components', () => ({
  AppButton:     { template: '<button @click="$emit(\'click\')"><slot /></button>', emits: ['click'] },
  AppBadge:      { template: '<span><slot /></span>' },
  AppModal:      { template: '<div><slot /><slot name="actions" /></div>' },
  AppAlert:      { template: '<div><slot /></div>' },
  AppSkeleton:   { template: '<div />' },
  AppTooltip:    { template: '<div><slot /></div>' },
  AppHelpDrawer: { template: '<div />' },
}))

import DebtsView from '@/views/debts/DebtsView.vue'
import type { Debt } from '@/types/debt.types'

const mkDebt = (overrides: Partial<Debt> = {}): Debt => ({
  id: 'd-1', name: 'Tarjeta Visa', initialAmount: 10000, remainingBalance: 8000,
  minimumPayment: 500, annualInterestRate: 18, rateType: 'fixed',
  rateLastUpdated: null, startDate: '2026-01-01', method: 'snowball',
  status: 'active', priorityOrder: 1, notes: null,
  isOverdue: false, lateInterestAmount: 0, cutoffDay: null, paymentDueDay: null,
  lateInterestRate: null, plazo: null, ivaRate: null, createdAt: '2026-01-01',
  ...overrides,
})

describe('DebtsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    debtsStoreMock.debts       = []
    debtsStoreMock.activeDebts = []
    debtsStoreMock.error       = null
    debtsStoreMock.planSnowball = null
    fetchAllMock.mockResolvedValue(undefined)
  })

  it('llama fetchAll en onMounted', async () => {
    shallowMount(DebtsView)
    await new Promise(r => setTimeout(r, 0))
    expect(fetchAllMock).toHaveBeenCalledTimes(1)
  })

  it('tab empieza en "list"', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    expect(vm.tab).toBe('list')
  })

  it('helpSlug es "registrar-deudas" cuando tab=list', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    expect(vm.helpSlug).toBe('registrar-deudas')
  })

  it('helpSlug es "estrategias-pago-deudas" cuando tab=plans', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    vm.tab = 'plans'
    expect(vm.helpSlug).toBe('estrategias-pago-deudas')
  })

  it('goToPlans cambia el tab a plans', async () => {
    const vm = (shallowMount(DebtsView) as any).vm
    await vm.goToPlans()
    expect(vm.tab).toBe('plans')
  })

  it('goToPlans llama fetchAllPlans si hay deudas activas y no hay plan', async () => {
    debtsStoreMock.activeDebts = [mkDebt()]
    fetchAllPlansMock.mockResolvedValue(undefined)
    const vm = (shallowMount(DebtsView) as any).vm
    await vm.goToPlans()
    expect(fetchAllPlansMock).toHaveBeenCalledTimes(1)
  })

  // ── Formateo ──────────────────────────────────────────────────────────

  it('fmt formatea como MXN', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    expect(vm.fmt(10000)).toContain('10,000')
  })

  it('formatStatus traduce "active" a "Activa"', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    expect(vm.formatStatus('active')).toBe('Activa')
    expect(vm.formatStatus('paid')).toBe('Liquidada')
    expect(vm.formatStatus('paused')).toBe('Pausada')
  })

  it('formatStatus devuelve el valor original para estados desconocidos', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    expect(vm.formatStatus('unknown')).toBe('unknown')
  })

  // ── Helpers de deuda ──────────────────────────────────────────────────

  it('paidAmount calcula el monto pagado', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    const debt = mkDebt({ initialAmount: 10000, remainingBalance: 8000 })
    expect(vm.paidAmount(debt)).toBe(2000)
  })

  it('paidAmount devuelve 0 si remainingBalance > initialAmount', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    const debt = mkDebt({ initialAmount: 5000, remainingBalance: 6000 })
    expect(vm.paidAmount(debt)).toBe(0)
  })

  it('debtProgress calcula el porcentaje pagado', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    const debt = mkDebt({ initialAmount: 10000, remainingBalance: 2000 })
    expect(vm.debtProgress(debt)).toBe(80)
  })

  it('debtProgressClass retorna correct para >= 80%', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    const debt = mkDebt({ initialAmount: 10000, remainingBalance: 2000 })
    expect(vm.debtProgressClass(debt)).toBe('progress-bar--great')
  })

  it('debtProgressClass retorna mid para >= 40%', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    const debt = mkDebt({ initialAmount: 10000, remainingBalance: 4000 })
    expect(vm.debtProgressClass(debt)).toBe('progress-bar--mid')
  })

  it('debtProgressClass retorna low para < 40%', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    const debt = mkDebt({ initialAmount: 10000, remainingBalance: 9000 })
    expect(vm.debtProgressClass(debt)).toBe('progress-bar--low')
  })

  it('overdueDebts filtra solo las deudas vencidas', () => {
    debtsStoreMock.debts = [mkDebt({ isOverdue: true }), mkDebt({ id: 'd-2', isOverdue: false })]
    const vm = (shallowMount(DebtsView) as any).vm
    expect(vm.overdueDebts).toHaveLength(1)
    expect(vm.overdueDebts[0].id).toBe('d-1')
  })

  // ── Navegación ────────────────────────────────────────────────────────

  it('goToDetail navega a DebtDetail con el id', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    vm.goToDetail('d-1')
    expect(pushMock).toHaveBeenCalledWith({ name: 'DebtDetail', params: { id: 'd-1' } })
  })

  // ── Modal crear/editar ────────────────────────────────────────────────

  it('openCreateModal limpia el form y muestra el modal', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    vm.openCreateModal()
    expect(vm.showCreate).toBe(true)
    expect(vm.editingId).toBeNull()
  })

  it('openEditModal carga los datos de la deuda', () => {
    const debt = mkDebt({ name: 'Visa', initialAmount: 15000 })
    const vm = (shallowMount(DebtsView) as any).vm
    vm.openEditModal(debt)
    expect(vm.showCreate).toBe(true)
    expect(vm.editingId).toBe('d-1')
    expect(vm.form.name).toBe('Visa')
    expect(vm.form.initialAmount).toBe(15000)
  })

  it('submitForm setea formError si falta name', async () => {
    const vm = (shallowMount(DebtsView) as any).vm
    vm.form.name          = ''
    vm.form.initialAmount = 10000
    vm.form.minimumPayment = 500
    await vm.submitForm()
    expect(vm.formError).toBeTruthy()
    expect(createDebtMock).not.toHaveBeenCalled()
  })

  it('submitForm llama a createDebt con datos válidos', async () => {
    createDebtMock.mockResolvedValue(mkDebt())
    const vm = (shallowMount(DebtsView) as any).vm
    vm.form.name           = 'Visa'
    vm.form.initialAmount  = 10000
    vm.form.minimumPayment = 500
    vm.form.startDate      = '2026-01-01'
    await vm.submitForm()
    expect(createDebtMock).toHaveBeenCalledTimes(1)
  })

  // ── Eliminar ──────────────────────────────────────────────────────────

  it('confirmDelete abre el modal con el id y nombre', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    vm.confirmDelete('d-1', 'Visa')
    expect(vm.deleteTarget).toEqual({ id: 'd-1', name: 'Visa' })
    expect(vm.deleteModalOpen).toBe(true)
  })

  it('onDeleteModalClose limpia el target si val=false', () => {
    const vm = (shallowMount(DebtsView) as any).vm
    vm.deleteTarget = { id: 'd-1', name: 'Visa' }
    vm.onDeleteModalClose(false)
    expect(vm.deleteTarget).toBeNull()
  })

  it('executeDelete no hace nada si no hay deleteTarget', async () => {
    const vm = (shallowMount(DebtsView) as any).vm
    vm.deleteTarget = null
    await vm.executeDelete()
    expect(removeDebtMock).not.toHaveBeenCalled()
  })

  it('executeDelete llama a removeDebt y cierra el modal', async () => {
    removeDebtMock.mockResolvedValue(undefined)
    const vm = (shallowMount(DebtsView) as any).vm
    vm.confirmDelete('d-1', 'Visa')
    await vm.executeDelete()
    expect(removeDebtMock).toHaveBeenCalledWith('d-1')
    expect(vm.deleteModalOpen).toBe(false)
  })
})
