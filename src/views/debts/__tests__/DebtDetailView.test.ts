import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const pushMock    = vi.fn()
const routeMock   = { params: { id: 'd-1' } }

vi.mock('vue-router', () => ({
  useRoute:   () => routeMock,
  useRouter:  () => ({ push: pushMock }),
  RouterLink: { template: '<a><slot /></a>' },
}))

const fetchOneMock          = vi.fn()
const fetchPaymentsMock     = vi.fn()
const fetchAmortizationMock = vi.fn()
const registerPaymentMock   = vi.fn()
const removePaymentMock     = vi.fn()
const updatePaymentMock     = vi.fn()
const updateDebtMock        = vi.fn()
const clearCurrentMock      = vi.fn()

const debtStoreMock = {
  current:         null as any,
  payments:        [] as any[],
  amortization:    [] as any[],
  amortizationMeta: null,
  loading:         false,
  error:           null as string | null,
  fetchOne:          fetchOneMock,
  fetchPayments:     fetchPaymentsMock,
  fetchAmortization: fetchAmortizationMock,
  registerPayment:   registerPaymentMock,
  removePayment:     removePaymentMock,
  updatePayment:     updatePaymentMock,
  updateDebt:        updateDebtMock,
  clearCurrent:      clearCurrentMock,
}

vi.mock('@/stores/debts.store', () => ({
  useDebtsStore: () => debtStoreMock,
}))

vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/components', () => ({
  AppButton:     { template: '<button @click="$emit(\'click\')"><slot /></button>', emits: ['click'] },
  AppBadge:      { template: '<span><slot /></span>' },
  AppModal:      { template: '<div><slot /><slot name="actions" /></div>' },
  AppAlert:      { template: '<div><slot /></div>' },
  AppTooltip:    { template: '<div><slot /></div>' },
  AppHelpDrawer: { template: '<div />' },
}))

import DebtDetailView from '@/views/debts/DebtDetailView.vue'
import type { Debt, DebtPayment } from '@/types/debt.types'

const mkDebt = (overrides: Partial<Debt> = {}): Debt => ({
  id: 'd-1', name: 'Tarjeta Visa', initialAmount: 10000, remainingBalance: 8000,
  minimumPayment: 500, annualInterestRate: 18, rateType: 'fixed',
  rateLastUpdated: null, startDate: '2026-01-01', method: 'snowball',
  status: 'active', priorityOrder: 1, notes: null,
  isOverdue: false, lateInterestAmount: 0, cutoffDay: null, paymentDueDay: null,
  lateInterestRate: null, plazo: null, ivaRate: null, createdAt: '2026-01-01',
  ...overrides,
})

const mkPayment = (overrides: Partial<DebtPayment> = {}): DebtPayment => ({
  id: 'p-1', debtId: 'd-1', scheduledAmount: 500, actualAmount: 500,
  paymentDate: '2026-07-01', note: null, transactionId: null, createdAt: '2026-01-01',
  ...overrides,
})

describe('DebtDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    debtStoreMock.current      = null
    debtStoreMock.payments     = []
    debtStoreMock.amortization = []
    debtStoreMock.error        = null
    fetchOneMock.mockResolvedValue(undefined)
    fetchPaymentsMock.mockResolvedValue(undefined)
    fetchAmortizationMock.mockResolvedValue(undefined)
  })

  it('se monta y llama fetchOne en onMounted', async () => {
    shallowMount(DebtDetailView)
    await new Promise(r => setTimeout(r, 0))
    expect(fetchOneMock).toHaveBeenCalledWith('d-1')
  })

  it('tab empieza en "pagos"', () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    expect(vm.tab).toBe('pagos')
  })

  it('helpSlug es "registrar-pagos" cuando tab=pagos', () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    expect(vm.helpSlug).toContain('pago')
  })

  it('goToAmortization cambia tab a amortizacion', async () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    await vm.goToAmortization()
    expect(vm.tab).toBe('amortizacion')
  })

  // ── Computeds sobre current ──────────────────────────────────────────

  it('paidAmount es 0 cuando no hay current', () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    expect(vm.paidAmount).toBe(0)
  })

  it('paidAmount calcula la diferencia inicial vs restante', () => {
    debtStoreMock.current = mkDebt({ initialAmount: 10000, remainingBalance: 8000 })
    const vm = (shallowMount(DebtDetailView) as any).vm
    expect(vm.paidAmount).toBe(2000)
  })

  it('progress es 0 cuando no hay current', () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    expect(vm.progress).toBe(0)
  })

  it('progress calcula el porcentaje pagado', () => {
    debtStoreMock.current = mkDebt({ initialAmount: 10000, remainingBalance: 2000 })
    const vm = (shallowMount(DebtDetailView) as any).vm
    expect(vm.progress).toBe(80)
  })

  // ── Formateo ──────────────────────────────────────────────────────────

  it('formatStatus traduce correctamente', () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    expect(vm.formatStatus('active')).toBe('Activa')
    expect(vm.formatStatus('paid')).toBe('Liquidada')
    expect(vm.formatStatus('paused')).toBe('Pausada')
  })

  it('formatMethod traduce correctamente', () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    expect(vm.formatMethod('snowball')).toContain('Bola')
    expect(vm.formatMethod('avalanche')).toContain('Avalancha')
  })

  // ── Modal pago ────────────────────────────────────────────────────────

  it('openPaymentModal abre el modal con el monto mínimo precargado', () => {
    debtStoreMock.current = mkDebt({ minimumPayment: 500 })
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.openPaymentModal()
    expect(vm.showPayment).toBe(true)
    expect(vm.payForm.actualAmount).toBe(500)
  })

  it('submitPayment setea payError si el monto es 0', async () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.payForm.actualAmount = 0
    await vm.submitPayment()
    expect(vm.payError).toBeTruthy()
    expect(registerPaymentMock).not.toHaveBeenCalled()
  })

  it('submitPayment llama a registerPayment con monto válido', async () => {
    registerPaymentMock.mockResolvedValue(undefined)
    debtStoreMock.current = mkDebt()
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.payForm.actualAmount = 500
    vm.payForm.paymentDate  = '2026-07-01'
    await vm.submitPayment()
    expect(registerPaymentMock).toHaveBeenCalledWith('d-1', expect.objectContaining({ actualAmount: 500 }))
    expect(vm.showPayment).toBe(false)
  })

  // ── Modal eliminar pago ───────────────────────────────────────────────

  it('openDeleteModal guarda el pago objetivo y abre el modal', () => {
    const pay = mkPayment()
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.openDeleteModal(pay)
    expect(vm.showDeleteModal).toBe(true)
    expect(vm.paymentToDelete).toEqual(pay)
  })

  it('confirmDeletePayment no hace nada si no hay paymentToDelete', async () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.paymentToDelete = null
    await vm.confirmDeletePayment()
    expect(removePaymentMock).not.toHaveBeenCalled()
  })

  it('confirmDeletePayment llama a removePayment y cierra el modal', async () => {
    removePaymentMock.mockResolvedValue(undefined)
    debtStoreMock.current = mkDebt()
    const pay = mkPayment()
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.openDeleteModal(pay)
    await vm.confirmDeletePayment()
    expect(removePaymentMock).toHaveBeenCalledWith('d-1', 'p-1')
    expect(vm.showDeleteModal).toBe(false)
  })

  // ── Modal editar pago ─────────────────────────────────────────────────

  it('openEditModal carga los datos del pago', () => {
    const pay = mkPayment({ actualAmount: 750, paymentDate: '2026-07-01', note: 'Nota' })
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.openEditModal(pay)
    expect(vm.showEditModal).toBe(true)
    expect(vm.editForm.actualAmount).toBe(750)
    expect(vm.editForm.paymentDate).toBe('2026-07-01')
  })

  it('confirmEditPayment no hace nada si no hay paymentToEdit', async () => {
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.paymentToEdit = null
    await vm.confirmEditPayment()
    expect(updatePaymentMock).not.toHaveBeenCalled()
  })

  it('confirmEditPayment llama a updatePayment y cierra el modal', async () => {
    updatePaymentMock.mockResolvedValue(undefined)
    debtStoreMock.current = mkDebt()
    const pay = mkPayment()
    const vm = (shallowMount(DebtDetailView) as any).vm
    vm.openEditModal(pay)
    vm.editForm.actualAmount = 600
    vm.editForm.paymentDate  = '2026-08-01'
    await vm.confirmEditPayment()
    expect(updatePaymentMock).toHaveBeenCalled()
    expect(vm.showEditModal).toBe(false)
  })
})
