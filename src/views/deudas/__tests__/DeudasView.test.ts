// Vista: "Deudas activas" (P4, solo socios, Modo Gestión). Contenedor:
// filtro de atrasadas, orden (fecha/saldo/cuota vencida), búsqueda por
// nombre, paginación, total general pendiente (GET /dashboard/summary, la
// misma fuente que la tarjeta de Inicio) y abre el detalle (modal, mismo
// patrón que Incidencias) al tocar una fila. Solo se simula la red
// (DeudasService, DashboardService).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import DeudasView from '../DeudasView.vue'
import DeudasService from '@/services/deudas.service'
import DashboardService from '@/services/dashboard.service'
import ProductsService from '@/services/products.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { Deuda, DeudaListResponse } from '@/types/deuda.types'
import type { DashboardSummary } from '@/types/report.types'

vi.mock('@/services/deudas.service', () => ({
  default: { listDeudas: vi.fn(), getDeuda: vi.fn(), createAbono: vi.fn() },
}))
vi.mock('@/services/dashboard.service', () => ({ default: { getSummary: vi.fn() } }))
vi.mock('@/services/products.service', () => ({ default: { getProduct: vi.fn() } }))

const listDeudas = vi.mocked(DeudasService.listDeudas)
const getSummary = vi.mocked(DashboardService.getSummary)

const SOCIO = { id: 'm-1', name: 'Ana', role: 'socio' as const, active: true }

function deuda(overrides: Partial<Deuda> = {}): Deuda {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    type: 'apartado',
    deudorId: '60000000-0000-4000-8000-000000000001',
    productId: '30000000-0000-4000-8000-000000000001',
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
    deudor: { id: '60000000-0000-4000-8000-000000000001', nombre: 'Lucía', telefono: null, notas: null, contextId: 'ctx', createdAt: '2026-09-23T12:00:00.000Z' },
    ...overrides,
  }
}

function page(items: Deuda[], overrides: Partial<DeudaListResponse> = {}): DeudaListResponse {
  return { items, total: items.length, page: 1, limit: 20, ...overrides }
}

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    ventasHoy: { totalMinor: 0, count: 0 },
    ventasAyer: { totalMinor: 0, count: 0 },
    gananciaHoyMinor: 0,
    lineasSinCostoHoy: 0,
    incidenciasPendientes: 0,
    deudasPendientes: { totalMinor: 90000, personas: 3 },
    productosPocaExistencia: { umbral: 2, total: 0, items: [] },
    ...overrides,
  }
}

async function mountView() {
  const session = useSessionStore()
  session.setMember(SOCIO)
  useUiModeStore().setMode('gestion')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app', name: 'AppHome', component: { template: '<div>inicio</div>' } },
      { path: '/app/deudas', name: 'Deudas', component: DeudasView },
    ],
  })
  router.push('/app/deudas')
  await router.isReady()
  const wrapper = mount(DeudasView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  listDeudas.mockReset().mockResolvedValue(page([deuda()]))
  getSummary.mockReset().mockResolvedValue(summary())
  vi.mocked(ProductsService.getProduct).mockReset()
})

describe('DeudasView — carga inicial', () => {
  it('pide GET /deudas con status=pendiente por defecto y muestra la lista', async () => {
    const { wrapper } = await mountView()
    expect(listDeudas).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 'pendiente', page: 1 }))
    expect(wrapper.text()).toContain('Lucía')
  })

  it('un fallo de red muestra un aviso con reintentar', async () => {
    listDeudas.mockRejectedValueOnce({ request: {} })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.')
    listDeudas.mockResolvedValueOnce(page([deuda()]))
    const retry = wrapper.findAll('button').find((b) => b.text().includes('Intentar de nuevo'))!
    await retry.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Lucía')
  })

  it('sin deudas muestra el estado vacío', async () => {
    listDeudas.mockResolvedValueOnce(page([]))
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No hay deudas con estos filtros.')
  })
})

describe('DeudasView — total general pendiente', () => {
  it('lo muestra desde GET /dashboard/summary', async () => {
    const { wrapper } = await mountView()
    expect(getSummary).toHaveBeenCalled()
    expect(wrapper.text()).toContain('$900.00')
    expect(wrapper.text()).toContain('3 personas')
  })
})

describe('DeudasView — filtro de atrasadas', () => {
  it('activarlo llama GET /deudas con atrasado=true', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await flushPromises()

    expect(listDeudas).toHaveBeenLastCalledWith(expect.objectContaining({ atrasado: true }))
  })
})

describe('DeudasView — orden', () => {
  it('cambiar a "Mayor saldo primero" llama con orderBy=saldoPendiente', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('select[aria-label], select').setValue('saldoPendiente')
    await flushPromises()

    expect(listDeudas).toHaveBeenLastCalledWith(expect.objectContaining({ orderBy: 'saldoPendiente' }))
  })
})

describe('DeudasView — búsqueda por nombre', () => {
  it('escribe y busca; llama GET /deudas con search y vuelve a la página 1', async () => {
    const { wrapper } = await mountView()
    const searchInput = wrapper.findAll('input').find((i) => i.attributes('placeholder') === 'Nombre de quien debe')!
    await searchInput.setValue('Luc')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(listDeudas).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Luc', page: 1 }))
  })
})

describe('DeudasView — indicador de atrasado (según lo que devuelve el backend)', () => {
  it('una deuda con cuota vencida y sin abonos suficientes muestra "Atrasada"', async () => {
    listDeudas.mockResolvedValue(page([deuda({
      cuotasPlaneadas: [{ id: 'c-1', deudaId: '70000000-0000-4000-8000-000000000001', contextId: 'ctx', fechaEsperada: '2020-01-01T00:00:00.000Z', montoEsperadoMinor: 5000, createdAt: '2019-01-01T00:00:00.000Z' }],
    })]))
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Atrasada')
  })

  it('una deuda sin cuotas vencidas NO muestra "Atrasada"', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.text()).not.toContain('Atrasada')
  })
})

describe('DeudasView — indicador liquidada/activa', () => {
  it('una deuda pendiente se marca "Activa" y una saldada "Liquidada"', async () => {
    listDeudas.mockResolvedValue(page([
      deuda({ id: 'd-activa', status: 'pendiente' }),
      deuda({ id: 'd-saldada', status: 'saldada', deudor: { id: '60000000-0000-4000-8000-000000000002', nombre: 'Carlos', telefono: null, notas: null, contextId: 'ctx', createdAt: '2026-09-23T12:00:00.000Z' } }),
    ], { total: 2 }))
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Activa')
    expect(wrapper.text()).toContain('Liquidada')
  })
})

describe('DeudasView — detalle como modal (D4, no una ruta)', () => {
  it('tocar una fila abre el detalle sin cambiar la URL', async () => {
    const { wrapper, router } = await mountView()
    await wrapper.get('[role="button"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/app/deudas')
    expect(wrapper.findComponent({ name: 'DeudaDetailModal' }).exists()).toBe(true)
  })
})
