// IncidenciaDetailModal — organismo: detalle + resolver de una incidencia (D2,
// modal sobre la lista, no una ruta `:id`). Al abrir pide GET /incidencias/:id
// (trae la venta anidada, solo ahí se expone); si está pendiente, muestra el
// formulario de resolver (PATCH /incidencias/:id/resolver); si ya está
// resuelta, solo lectura. IncidenciasService real mockeado.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import IncidenciaDetailModal from '../IncidenciaDetailModal.vue'
import IncidenciasService from '@/services/incidencias.service'
import type { IncidenciaWithSale } from '@/types/incidencia.types'

vi.mock('@/services/incidencias.service', () => ({
  default: { getIncidencia: vi.fn(), resolverIncidencia: vi.fn() },
}))

const getIncidencia = vi.mocked(IncidenciasService.getIncidencia)
const resolverIncidencia = vi.mocked(IncidenciasService.resolverIncidencia)

const ID = '50000000-0000-4000-8000-000000000001'

function pendingDetail(over: Partial<IncidenciaWithSale> = {}): IncidenciaWithSale {
  return {
    id: ID,
    saleId: '40000000-0000-4000-8000-000000000002',
    contextId: 'bazar-local',
    type: 'conflicto_stock',
    reason: 'stock insuficiente al sincronizar: producto p-1, solicitado 1, disponible 0',
    detectedAt: '2026-09-23T12:00:02.000Z',
    resolutionStatus: 'pendiente',
    resolvedByMemberId: null,
    resolvedAt: null,
    resolutionNotes: null,
    sale: {
      id: '40000000-0000-4000-8000-000000000002',
      memberId: 'm-1',
      deviceId: 'd-1',
      occurredAt: '2026-09-23T12:00:00.000Z',
      receivedAt: '2026-09-23T12:00:01.000Z',
      currency: 'MXN',
      status: 'rechazada_por_conflicto',
      totalMinor: null,
      cashReceivedMinor: 5000,
      changeMinor: null,
      conflictReason: 'stock insuficiente',
      conflictDetectedAt: '2026-09-23T12:00:02.000Z',
      contextId: 'bazar-local',
      requestFingerprint: 'fp-1',
      items: [],
    },
    ...over,
  }
}

function mountModal(props: Partial<{ modelValue: boolean; incidenciaId: string | null }> = {}) {
  return mount(IncidenciaDetailModal, {
    props: { modelValue: true, incidenciaId: ID, ...props },
    global: { stubs: { teleport: true } },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getIncidencia.mockResolvedValue(pendingDetail())
  resolverIncidencia.mockResolvedValue({ ...pendingDetail(), resolutionStatus: 'resuelta' } as never)
})

describe('IncidenciaDetailModal — abrir y cargar', () => {
  it('cerrado (modelValue=false) no pide el detalle', () => {
    mountModal({ modelValue: false })
    expect(getIncidencia).not.toHaveBeenCalled()
  })

  it('al abrir pide GET /incidencias/:id y muestra el motivo mientras carga y después', async () => {
    let resolve!: (v: IncidenciaWithSale) => void
    getIncidencia.mockReturnValue(new Promise((r) => { resolve = r }))
    const wrapper = mountModal()
    expect(wrapper.text()).toMatch(/Cargando/)
    resolve(pendingDetail())
    await flushPromises()
    expect(getIncidencia).toHaveBeenCalledExactlyOnceWith(ID)
    expect(wrapper.text()).toContain('stock insuficiente al sincronizar')
  })

  it('un fallo al cargar muestra un aviso con reintentar', async () => {
    getIncidencia.mockRejectedValueOnce({ response: { status: 500 } })
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toMatch(/No pudimos cargar/)
    getIncidencia.mockResolvedValueOnce(pendingDetail())
    await wrapper.find('button.incidencia-detail-modal__retry').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('stock insuficiente al sincronizar')
  })
})

describe('IncidenciaDetailModal — pendiente: formulario de resolver', () => {
  it('muestra el formulario y el botón se deshabilita sin notas', async () => {
    const wrapper = mountModal()
    await flushPromises()
    const submit = wrapper.find('button.incidencia-detail-modal__resolve')
    expect(submit.exists()).toBe(true)
    expect((submit.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('escribir notas y enviar llama a resolverIncidencia con el id y las notas exactas', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.get('textarea').setValue('Se acordó no cobrar la pieza faltante.')
    await wrapper.get('button.incidencia-detail-modal__resolve').trigger('click')
    await flushPromises()
    expect(resolverIncidencia).toHaveBeenCalledExactlyOnceWith(ID, 'Se acordó no cobrar la pieza faltante.')
  })

  it('al resolver bien pasa a modo lectura y avisa al padre (evento resolved)', async () => {
    const resolved = { ...pendingDetail(), resolutionStatus: 'resuelta' as const, resolvedByMemberId: 'm-9', resolvedAt: '2026-09-23T14:00:00.000Z', resolutionNotes: 'Ya se resolvió.' }
    resolverIncidencia.mockResolvedValue(resolved)
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.get('textarea').setValue('Ya se resolvió.')
    await wrapper.get('button.incidencia-detail-modal__resolve').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('resolved')).toEqual([[resolved]])
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.text()).toContain('Ya se resolvió.')
  })

  it('un 409 (ya estaba resuelta) avisa y refleja el estado más reciente, sin culpar a la red', async () => {
    resolverIncidencia.mockRejectedValueOnce({ response: { status: 409 } })
    const alreadyResolved = { ...pendingDetail(), resolutionStatus: 'resuelta' as const, resolvedByMemberId: 'm-2', resolvedAt: '2026-09-23T13:00:00.000Z', resolutionNotes: 'Resuelta por otro socio.' }
    getIncidencia.mockResolvedValueOnce(pendingDetail()).mockResolvedValueOnce(alreadyResolved)
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.get('textarea').setValue('Mi intento de notas.')
    await wrapper.get('button.incidencia-detail-modal__resolve').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toMatch(/ya estaba resuelta/i)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.text()).toContain('Resuelta por otro socio.')
  })

  it('notas vacías o solo espacios no llaman a la API', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.get('textarea').setValue('   ')
    await wrapper.get('button.incidencia-detail-modal__resolve').trigger('click')
    await flushPromises()
    expect(resolverIncidencia).not.toHaveBeenCalled()
  })
})

describe('IncidenciaDetailModal — resuelta: solo lectura', () => {
  it('no muestra formulario, muestra notas y fecha de resolución', async () => {
    getIncidencia.mockResolvedValueOnce({
      ...pendingDetail(),
      resolutionStatus: 'resuelta',
      resolvedByMemberId: 'm-1',
      resolvedAt: '2026-09-23T14:00:00.000Z',
      resolutionNotes: 'Se le avisó al cliente.',
    })
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.find('button.incidencia-detail-modal__resolve').exists()).toBe(false)
    expect(wrapper.text()).toContain('Se le avisó al cliente.')
  })
})

describe('IncidenciaDetailModal — venta anidada', () => {
  it('sin venta (contrato la omite) muestra un aviso en vez de romper', async () => {
    const withoutSale = { ...pendingDetail() }
    // @ts-expect-error: simula un contrato sin `sale` (defensivo)
    delete withoutSale.sale
    getIncidencia.mockResolvedValueOnce(withoutSale)
    const wrapper = mountModal()
    await flushPromises()
    expect(wrapper.text()).toMatch(/No pudimos mostrar la venta/)
  })
})

describe('IncidenciaDetailModal — cerrar', () => {
  it('emite update:modelValue en false al cerrar', async () => {
    const wrapper = mountModal()
    await flushPromises()
    await wrapper.get('button.incidencia-detail-modal__close').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
