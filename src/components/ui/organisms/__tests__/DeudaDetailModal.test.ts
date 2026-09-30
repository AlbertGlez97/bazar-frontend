// Detalle de una deuda (P4): modal sobre la lista (mismo patrón que
// IncidenciaDetailModal) — nunca una ruta `:id` (no existe ninguna en este
// proyecto). Al abrir pide GET /deudas/:id y GET /products/:id (para el
// nombre del producto, que Deuda no trae). Muestra deudor, producto, total,
// historial de abonos, calendario de cuotas si tiene, indicador liquidada/
// activa y un botón para registrar un abono nuevo.
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DeudaDetailModal from '../DeudaDetailModal.vue'
import DeudasService from '@/services/deudas.service'
import ProductsService from '@/services/products.service'
import type { Deuda } from '@/types/deuda.types'
import type { Product } from '@/types/product.types'

vi.mock('@/services/deudas.service', () => ({ default: { getDeuda: vi.fn(), createAbono: vi.fn() } }))
vi.mock('@/services/products.service', () => ({ default: { getProduct: vi.fn() } }))

const getDeuda = vi.mocked(DeudasService.getDeuda)
const createAbono = vi.mocked(DeudasService.createAbono)
const getProduct = vi.mocked(ProductsService.getProduct)

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p-1', name: 'Sarape', tipo: 'unica', unitPriceMinor: 85000, initialStock: 1, stock: 0,
    category: null, purchaseCostMinor: null, supplier: null, notes: null,
    createdAt: '2026-09-01T00:00:00.000Z', active: true, image: null, ...overrides,
  }
}

function deuda(overrides: Partial<Deuda> = {}): Deuda {
  return {
    id: 'd-1',
    type: 'apartado',
    deudorId: 'deudor-1',
    productId: 'p-1',
    contextId: 'ctx',
    cantidad: 1,
    totalMinor: 65000,
    status: 'pendiente',
    unitCostMinor: null,
    saldadaAt: null,
    createdByMemberId: 'm-1',
    createdAt: '2026-09-23T12:00:00.000Z',
    abonos: [],
    cuotasPlaneadas: [],
    deudor: { id: 'deudor-1', nombre: 'Lucía', telefono: '555-0001', notas: 'Pasa el sábado', contextId: 'ctx', createdAt: '2026-09-23T12:00:00.000Z' },
    ...overrides,
  }
}

function mountModal(props: Partial<{ modelValue: boolean; deudaId: string | null }> = {}) {
  return mount(DeudaDetailModal, {
    props: { modelValue: true, deudaId: 'd-1', ...props },
    global: { stubs: { teleport: true } },
  })
}

beforeEach(() => {
  getDeuda.mockReset().mockResolvedValue(deuda())
  getProduct.mockReset().mockResolvedValue(product())
  createAbono.mockReset()
})

describe('DeudaDetailModal — carga', () => {
  it('pide GET /deudas/:id y GET /products/:id al abrir, y muestra deudor/producto/total', async () => {
    const wrapper = mountModal()
    await flushPromises()

    expect(getDeuda).toHaveBeenCalledExactlyOnceWith('d-1')
    expect(getProduct).toHaveBeenCalledExactlyOnceWith('p-1')
    expect(wrapper.text()).toContain('Lucía')
    expect(wrapper.text()).toContain('Sarape')
    expect(wrapper.text()).toContain('$650.00')
  })

  it('muestra un error amable si la carga falla', async () => {
    getDeuda.mockRejectedValue({ isAxiosError: true, response: { status: 500 } })
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain('No pudimos cargar el detalle de esta deuda.')
  })
})

describe('DeudaDetailModal — indicador liquidada/activa', () => {
  it('una deuda pendiente muestra "Activa"', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toContain('Activa')
  })

  it('una deuda saldada muestra "Liquidada" y NO ofrece registrar abono', async () => {
    getDeuda.mockResolvedValue(deuda({ status: 'saldada', abonos: [{ id: 'a-1', deudaId: 'd-1', contextId: 'ctx', montoMinor: 65000, receivedByMemberId: 'm-1', receivedAt: '2026-09-24T00:00:00.000Z', nota: null }] }))
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain('Liquidada')
    expect(wrapper.find('[data-action="submit-abono"]').exists()).toBe(false)
  })
})

describe('DeudaDetailModal — historial de abonos y cuotas', () => {
  it('sin abonos, muestra el mensaje vacío', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toContain('Todavía no hay abonos registrados.')
  })

  it('con abonos, lista cada uno', async () => {
    getDeuda.mockResolvedValue(deuda({
      abonos: [{ id: 'a-1', deudaId: 'd-1', contextId: 'ctx', montoMinor: 20000, receivedByMemberId: 'm-1', receivedAt: '2026-09-24T00:00:00.000Z', nota: 'Primer pago' }],
    }))
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain('$200.00')
    expect(wrapper.text()).toContain('Primer pago')
  })

  it('sin cuotas planeadas, muestra el mensaje vacío', async () => {
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toContain('No se programaron fechas de pago para esta deuda.')
  })

  it('con cuotas planeadas, las lista', async () => {
    getDeuda.mockResolvedValue(deuda({
      cuotasPlaneadas: [{ id: 'c-1', deudaId: 'd-1', contextId: 'ctx', fechaEsperada: '2026-10-15T00:00:00.000Z', montoEsperadoMinor: 32500, createdAt: '2026-09-23T12:00:00.000Z' }],
    }))
    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.text()).toContain('$325.00')
  })
})

describe('DeudaDetailModal — registrar abono nuevo', () => {
  it('un monto válido llama POST /deudas/:id/abonos y refresca el detalle', async () => {
    const wrapper = mountModal()
    await flushPromises()
    const updated = deuda({ abonos: [{ id: 'a-1', deudaId: 'd-1', contextId: 'ctx', montoMinor: 10000, receivedByMemberId: 'm-1', receivedAt: '2026-09-25T00:00:00.000Z', nota: null }] })
    createAbono.mockResolvedValue(updated)

    await wrapper.get('input[inputmode="decimal"]').setValue('100.00')
    await wrapper.get('[data-action="submit-abono"]').trigger('click')
    await flushPromises()

    expect(createAbono).toHaveBeenCalledExactlyOnceWith('d-1', { montoMinor: 10000 })
    expect(wrapper.emitted('abono-registrado')?.[0]).toEqual([updated])
    expect(wrapper.text()).toContain('$100.00')
  })

  it('monto vacío o 0 no llama al servicio y muestra el error', async () => {
    const wrapper = mountModal()
    await flushPromises()

    await wrapper.get('[data-action="submit-abono"]').trigger('click')

    expect(createAbono).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe un monto mayor a $0.00.')
  })

  it('un fallo del servidor muestra el aviso sin perder el detalle ya cargado', async () => {
    const wrapper = mountModal()
    await flushPromises()
    createAbono.mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { message: 'Abono of 100000 exceeds the remaining balance of 65000' } } })

    await wrapper.get('input[inputmode="decimal"]').setValue('1000.00')
    await wrapper.get('[data-action="submit-abono"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Lucía') // el detalle sigue ahí
  })
})

describe('DeudaDetailModal — cerrar', () => {
  it('emite update:modelValue false al cerrar', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.get('[data-action="close-deuda-detail"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
