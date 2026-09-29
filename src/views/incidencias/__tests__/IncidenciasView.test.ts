// Vista: lista de Incidencias (P2, solo socios, Modo Gestión). Contenedor:
// filtros (tipo/estado/búsqueda/orden), paginación, y abre el modal de
// detalle+resolver (D2) al tocar una fila. Mismo patrón de guard vivo que
// ReportsView/CodigosQrView (watch modo+rol). IncidenciasService mockeado.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import IncidenciasView from '../IncidenciasView.vue'
import IncidenciasService from '@/services/incidencias.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { Incidencia, IncidenciaListResponse } from '@/types/incidencia.types'

vi.mock('@/services/incidencias.service', () => ({
  default: { listIncidencias: vi.fn(), getIncidencia: vi.fn(), resolverIncidencia: vi.fn() },
}))

const listIncidencias = vi.mocked(IncidenciasService.listIncidencias)
const getIncidencia = vi.mocked(IncidenciasService.getIncidencia)

const SOCIO = { id: 'm-1', name: 'Ana', role: 'socio' as const, active: true }

function item(over: Partial<Incidencia> = {}): Incidencia {
  return {
    id: '50000000-0000-4000-8000-000000000001',
    saleId: '40000000-0000-4000-8000-000000000002',
    contextId: 'bazar-local',
    type: 'conflicto_stock',
    reason: 'stock insuficiente al sincronizar: producto p-1, solicitado 1, disponible 0',
    detectedAt: '2026-09-23T12:00:02.000Z',
    resolutionStatus: 'pendiente',
    resolvedByMemberId: null,
    resolvedAt: null,
    resolutionNotes: null,
    ...over,
  }
}

function page(items: Incidencia[], over: Partial<IncidenciaListResponse> = {}): IncidenciaListResponse {
  return { items, total: items.length, page: 1, limit: 20, ...over }
}

async function mountView(options: { role?: 'socio' | 'colaborador'; mode?: 'gestion' | 'venta'; query?: string } = {}) {
  const session = useSessionStore()
  session.setMember({ ...SOCIO, role: options.role ?? 'socio' })
  useUiModeStore().setMode(options.mode ?? 'gestion')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app', name: 'AppHome', component: { template: '<div>inicio</div>' } },
      { path: '/app/incidencias', name: 'Incidencias', component: IncidenciasView },
    ],
  })
  router.push(`/app/incidencias${options.query ?? ''}`)
  await router.isReady()
  const wrapper = mount(IncidenciasView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  listIncidencias.mockReset().mockResolvedValue(page([item()]))
  getIncidencia.mockReset()
})

describe('IncidenciasView — carga inicial', () => {
  it('pide GET /incidencias sin filtro de estado por defecto y muestra la lista', async () => {
    const { wrapper } = await mountView()
    expect(listIncidencias).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ page: 1 }))
    expect(listIncidencias.mock.calls[0][0]).not.toHaveProperty('resolutionStatus')
    expect(wrapper.text()).toContain('stock insuficiente al sincronizar')
  })

  it('un fallo de red muestra un aviso con reintentar', async () => {
    listIncidencias.mockRejectedValueOnce({ request: {} })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.')
    listIncidencias.mockResolvedValueOnce(page([item()]))
    const retry = wrapper.findAll('button').find((b) => b.text().includes('Intentar de nuevo'))!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('stock insuficiente al sincronizar')
  })

  it('sin incidencias muestra el estado vacío', async () => {
    listIncidencias.mockResolvedValueOnce(page([]))
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No hay incidencias con estos filtros.')
  })
})

describe('IncidenciasView — filtros', () => {
  it('cambiar el tipo vuelve a pedir con `type` y a la página 1', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('select.incidencias-view__filter-type').setValue('incidencia_fecha')
    await flushPromises()
    expect(listIncidencias).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'incidencia_fecha', page: 1 }))
  })

  it('cambiar el estado vuelve a pedir con `resolutionStatus`', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('select.incidencias-view__filter-status').setValue('resuelta')
    await flushPromises()
    expect(listIncidencias).toHaveBeenLastCalledWith(expect.objectContaining({ resolutionStatus: 'resuelta', page: 1 }))
  })

  it('elegir "Todas" quita el filtro de estado (no manda `resolutionStatus`)', async () => {
    const { wrapper } = await mountView({ query: '?resolutionStatus=pendiente' })
    await wrapper.get('select.incidencias-view__filter-status').setValue('')
    await flushPromises()
    expect(listIncidencias.mock.calls.at(-1)?.[0]).not.toHaveProperty('resolutionStatus')
  })

  it('buscar manda `search` (nombre del vendedor)', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('input.incidencias-view__search').setValue('Carlos')
    await wrapper.get('form.incidencias-view__search-form').trigger('submit')
    await flushPromises()
    expect(listIncidencias).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Carlos', page: 1 }))
  })

  it('cambiar el orden manda `sort`', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('select.incidencias-view__sort').setValue('asc')
    await flushPromises()
    expect(listIncidencias).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'asc' }))
  })
})

describe('IncidenciasView — query param del Inicio (P2, mismo patrón que "pocaExistencia" de P1)', () => {
  it('con ?resolutionStatus=pendiente preactiva el filtro de pendientes al montar', async () => {
    await mountView({ query: '?resolutionStatus=pendiente' })
    expect(listIncidencias).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ resolutionStatus: 'pendiente' }))
  })

  it('sin el query param arranca sin filtro de estado (todas)', async () => {
    await mountView()
    expect(listIncidencias.mock.calls[0][0]).not.toHaveProperty('resolutionStatus')
  })
})

describe('IncidenciasView — permisos vivos (mismo patrón que ReportsView/CodigosQrView)', () => {
  it('deja de ser socio mientras está abierta y manda a Inicio', async () => {
    const { router } = await mountView()
    useSessionStore().setMember({ ...SOCIO, role: 'colaborador' })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it('cambiar a Modo Venta mientras está abierta manda a Inicio (mismo `watch` de Reportes/Códigos QR)', async () => {
    const { router } = await mountView()
    useUiModeStore().setMode('venta')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('AppHome')
  })
})

describe('IncidenciasView — abrir el detalle (D2: modal, no ruta)', () => {
  it('tocar una fila abre el modal y pide GET /incidencias/:id', async () => {
    getIncidencia.mockResolvedValue({ ...item(), sale: { id: 's-1', memberId: 'm-1', deviceId: 'd-1', occurredAt: '2026-09-23T12:00:00.000Z', receivedAt: '2026-09-23T12:00:01.000Z', currency: 'MXN', status: 'rechazada_por_conflicto', totalMinor: null, cashReceivedMinor: 0, changeMinor: null, conflictReason: null, conflictDetectedAt: null, contextId: 'bazar-local', requestFingerprint: null, items: [] } })
    const { wrapper } = await mountView()
    await wrapper.get('.incidencias-view__row').trigger('click')
    await flushPromises()
    expect(getIncidencia).toHaveBeenCalledExactlyOnceWith(item().id)
  })
})
