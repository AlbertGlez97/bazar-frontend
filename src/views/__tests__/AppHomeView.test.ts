// Vista: Inicio de Modo Gestión (contenedor). Store REALES (sesión, modo);
// solo se simula la red (DashboardService). Mismo patrón que ReportsView.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AppHomeView from '../AppHomeView.vue'
import DashboardService from '@/services/dashboard.service'
import { useSessionStore } from '@/stores/session.store'
import { useUiModeStore } from '@/stores/uiMode.store'
import type { DashboardSummary } from '@/types/report.types'

vi.mock('@/services/dashboard.service', () => ({ default: { getSummary: vi.fn() } }))

const getSummary = vi.mocked(DashboardService.getSummary)

const SOCIO = { id: 'm-1', name: 'Ana', role: 'socio' as const, active: true }

const summary = (over: Partial<DashboardSummary> = {}): DashboardSummary => ({
  ventasHoy: { totalMinor: 130050, count: 2 },
  ventasAyer: { totalMinor: 100000, count: 1 },
  gananciaHoyMinor: 35000,
  lineasSinCostoHoy: 0,
  incidenciasPendientes: 3,
  deudasPendientes: { totalMinor: 50000, personas: 2 },
  productosPocaExistencia: {
    umbral: 2,
    total: 4,
    items: [
      { id: 'p-1', name: 'Café de olla', stock: 1, category: 'Bebidas' },
      { id: 'p-2', name: 'Pan dulce', stock: 2, category: null },
    ],
  },
  ...over,
})

async function mountView(options: { role?: 'socio' | 'colaborador'; mode?: 'gestion' | 'venta' } = {}) {
  const session = useSessionStore()
  session.setMember({ ...SOCIO, role: options.role ?? 'socio' })
  useUiModeStore().setMode(options.mode ?? 'gestion')
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app', name: 'AppHome', component: AppHomeView },
      { path: '/app/productos', name: 'ProductCatalog', component: { template: '<div>productos</div>' } },
      { path: '/app/reportes', name: 'Reports', component: { template: '<div>reportes</div>' } },
      { path: '/app/incidencias', name: 'Incidencias', component: { template: '<div>incidencias</div>' } },
      { path: '/app/deudas', name: 'Deudas', component: { template: '<div>deudas</div>' } },
    ],
  })
  router.push('/app')
  await router.isReady()
  const wrapper = mount(AppHomeView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  getSummary.mockReset().mockResolvedValue(summary())
})

describe('AppHomeView — carga y presentación', () => {
  it('muestra un esqueleto mientras carga y lo quita cuando responde', async () => {
    let resolve!: (value: DashboardSummary) => void
    getSummary.mockReturnValue(new Promise((r) => { resolve = r }))
    const { wrapper } = await mountView()
    expect(wrapper.find('.app-home__skeleton').exists()).toBe(true)
    expect(wrapper.find('.app-home__cards').exists()).toBe(false)
    resolve(summary())
    await flushPromises()
    expect(wrapper.find('.app-home__skeleton').exists()).toBe(false)
    expect(wrapper.find('.app-home__cards').exists()).toBe(true)
  })

  it('muestra las tarjetas con los números correctos', async () => {
    const { wrapper } = await mountView()
    expect(getSummary).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text).toContain('$1,300.50') // ventas hoy
    expect(text).toContain('$350.00')   // ganancia hoy
    expect(text).toContain('3')          // incidencias pendientes
    expect(text).toContain('$500.00')   // deudas
    expect(text).toContain('2 personas')
    expect(text).toContain('4')          // poca existencia total
    expect(text).toContain('Café de olla')
    expect(text).toContain('Pan dulce')
  })

  it('la ganancia trae nota de parcial cuando hay líneas sin costo, y ninguna cuando no hay', async () => {
    getSummary.mockResolvedValueOnce(summary({ lineasSinCostoHoy: 3 }))
    const { wrapper: withGap } = await mountView()
    expect(withGap.text()).toContain('3 líneas de hoy sin costo capturado')

    getSummary.mockResolvedValueOnce(summary({ lineasSinCostoHoy: 0 }))
    const { wrapper: withoutGap } = await mountView()
    expect(withoutGap.text()).not.toContain('sin costo capturado')
  })
})

describe('AppHomeView — "Incidencias pendientes" lleva a la lista filtrada (P2)', () => {
  it('es clickeable y navega con el filtro de pendientes preactivado', async () => {
    const { wrapper } = await mountView()
    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href'))
    // "ventas hoy" (→ Reportes), "incidencias pendientes" (→ Incidencias,
    // filtrado), "deudas por cobrar" (→ Deudas) y "poca existencia" (→
    // Productos, con el filtro preactivado).
    expect(hrefs).toEqual(['/app/reportes', '/app/incidencias?resolutionStatus=pendiente', '/app/deudas', '/app/productos?pocaExistencia=1'])
  })
})

describe('AppHomeView — "Deudas por cobrar" lleva a la vista de Deudas', () => {
  it('es clickeable y navega a /app/deudas', async () => {
    const { wrapper } = await mountView()
    const debtsCard = wrapper.findAll('.app-home__cards > *').find((el) => el.text().includes('Deudas por cobrar'))!
    expect(debtsCard.element.tagName).toBe('A')
    expect(debtsCard.attributes('href')).toBe('/app/deudas')
  })
})

describe('AppHomeView — errores', () => {
  it('un fallo de red muestra un aviso con reintentar, y reintentar vuelve a pedir los datos', async () => {
    getSummary.mockRejectedValueOnce({ isAxiosError: true, request: {} })
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('No pudimos conectarnos. Revisa tu internet e intenta de nuevo.')
    expect(wrapper.find('.app-home__cards').exists()).toBe(false)

    const retry = wrapper.findAll('button').find((b) => b.text().includes('Intentar de nuevo'))!
    await retry.trigger('click')
    await flushPromises()
    expect(getSummary).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.app-home__cards').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('No pudimos conectarnos')
  })
})

describe('AppHomeView — un colaborador no ve el resumen', () => {
  it('no pide el resumen y no muestra las tarjetas', async () => {
    const { wrapper } = await mountView({ role: 'colaborador' })
    expect(getSummary).not.toHaveBeenCalled()
    expect(wrapper.find('.app-home__cards').exists()).toBe(false)
    expect(wrapper.text()).toContain('son solo para socios')
  })
})

describe('AppHomeView — el par de condiciones (modo Gestión + socio)', () => {
  it('en Modo Venta tampoco pide el resumen', async () => {
    const { wrapper } = await mountView({ mode: 'venta' })
    expect(getSummary).not.toHaveBeenCalled()
    expect(wrapper.find('.app-home__cards').exists()).toBe(false)
  })
})
