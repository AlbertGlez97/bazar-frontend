import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount } from '@vue/test-utils'

const fetchAllMock = vi.fn()
const createMock   = vi.fn()
const removeMock   = vi.fn()

vi.mock('@/stores/msi.store', () => ({
  useMsiStore: () => ({
    compras: [],
    loading: false,
    fetchAll: fetchAllMock,
    create:   createMock,
    remove:   removeMock,
  }),
}))

// Stub de todos los componentes UI usados en MsiView
vi.mock('@/components/ui/atoms/AppButton.vue',   () => ({ default: { template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/atoms/AppInput.vue',    () => ({ default: { template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/atoms/AppSelect.vue',   () => ({ default: { template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/atoms/AppBadge.vue',    () => ({ default: { template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/atoms/AppProgress.vue', () => ({ default: { template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/atoms/AppSkeleton.vue', () => ({ default: { template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/atoms/AppTooltip.vue',  () => ({ default: { template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/organisms/AppCard.vue', () => ({ default: { template: '<div><slot /></div>' } }))
vi.mock('@/components/ui/organisms/AppModal.vue',() => ({ default: { template: '<div><slot /></div>' } }))

import MsiView from '@/views/budget/MsiView.vue'
import type { MsiPurchase } from '@/types/msi.types'

const mkPurchase = (overrides: Partial<MsiPurchase> = {}): MsiPurchase => ({
  id: 'msi-1', userId: 'u-1', name: 'Laptop', store: null,
  totalAmount: 24000, installments: 12, monthlyAmount: 2000,
  startYear: 2025, startMonth: 1, status: 'active', createdAt: '2025-01-01',
  ...overrides,
})

describe('MsiView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAllMock.mockResolvedValue(undefined)
  })

  it('se monta y llama fetchAll en onMounted', async () => {
    shallowMount(MsiView)
    await new Promise(r => setTimeout(r, 0))
    expect(fetchAllMock).toHaveBeenCalledTimes(1)
  })

  it('cuotaActual devuelve el número de cuota actual correctamente', () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    // compra que empezó hace muchos meses → cuota mínima = 1
    const old = mkPurchase({ startYear: 2020, startMonth: 1, installments: 12 })
    // cuotaActual no puede exceder installments
    expect(vm.cuotaActual(old)).toBe(12)
  })

  it('cuotaActual para compra nueva (mes actual) es 1', () => {
    const now = new Date()
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    const nueva = mkPurchase({ startYear: now.getFullYear(), startMonth: now.getMonth() + 1, installments: 12 })
    expect(vm.cuotaActual(nueva)).toBe(1)
  })

  it('cuotasPercent es 100 para una compra vencida', () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    const old = mkPurchase({ startYear: 2020, startMonth: 1, installments: 12 })
    expect(vm.cuotasPercent(old)).toBe(100)
  })

  it('cuotasPercent es 8 para una compra nueva con 12 mensualidades (1/12)', () => {
    const now = new Date()
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    const nueva = mkPurchase({ startYear: now.getFullYear(), startMonth: now.getMonth() + 1, installments: 12 })
    expect(vm.cuotasPercent(nueva)).toBe(8)
  })

  it('fmt formatea número como MXN', () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    expect(vm.fmt(5000)).toContain('5,000')
  })

  it('validateForm falla con campos vacíos', () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    // form inicial: name='' totalAmount=0 installments=12
    expect(vm.validateForm()).toBe(false)
    expect(vm.errors.name).toBe('Requerido')
    expect(vm.errors.totalAmount).toBe('Debe ser mayor a 0')
  })

  it('validateForm falla si installments < 2', () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    vm.form.name         = 'Laptop'
    vm.form.totalAmount  = 5000
    vm.form.installments = 1
    expect(vm.validateForm()).toBe(false)
    expect(vm.errors.installments).toBe('Mínimo 2 meses')
  })

  it('validateForm pasa con datos válidos', () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    vm.form.name         = 'Laptop'
    vm.form.totalAmount  = 24000
    vm.form.installments = 12
    expect(vm.validateForm()).toBe(true)
  })

  it('handleSubmit NO llama a create si el form es inválido', async () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    await vm.handleSubmit()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('handleSubmit llama a create y cierra el modal si form es válido', async () => {
    createMock.mockResolvedValue({})
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    vm.form.name         = 'Laptop'
    vm.form.totalAmount  = 24000
    vm.form.installments = 12
    vm.showModal = true
    await vm.handleSubmit()
    expect(createMock).toHaveBeenCalled()
    expect(vm.showModal).toBe(false)
  })

  it('confirmCancel setea el id y abre el modal de cancelación', () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    vm.confirmCancel('msi-1')
    expect(vm.cancelTargetId).toBe('msi-1')
    expect(vm.showCancelModal).toBe(true)
  })

  it('doCancel no hace nada si no hay cancelTargetId', async () => {
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    await vm.doCancel()
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('doCancel llama a remove y cierra el modal', async () => {
    removeMock.mockResolvedValue(undefined)
    const wrapper = shallowMount(MsiView)
    const vm = wrapper.vm as any
    vm.cancelTargetId  = 'msi-1'
    vm.showCancelModal = true
    await vm.doCancel()
    expect(removeMock).toHaveBeenCalledWith('msi-1')
    expect(vm.showCancelModal).toBe(false)
  })
})
