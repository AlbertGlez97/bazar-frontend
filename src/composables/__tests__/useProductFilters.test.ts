import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, nextTick, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useProductFilters } from '../useProductFilters'
import { emptyProductFilters } from '@/utils/product-filters'

async function setup(initialUrl = '/productos', options: { allowInactive?: boolean; withRouter?: boolean } = {}) {
  const allowInactive = ref(options.allowInactive ?? true)
  let api!: ReturnType<typeof useProductFilters>
  const Harness = defineComponent({
    setup() {
      api = useProductFilters({ allowInactive })
      return () => null
    },
  })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/productos', component: Harness }, { path: '/otra', component: Harness }],
  })
  const app = createApp(Harness)
  if (options.withRouter !== false) {
    router.push(initialUrl)
    await router.isReady()
    app.use(router)
  }
  app.mount(document.createElement('div'))
  return { api, router, allowInactive, app }
}

describe('useProductFilters', () => {
  it('sin parámetros en la URL arranca con todo apagado', async () => {
    const { api } = await setup()

    expect(api.filters.value).toEqual(emptyProductFilters())
    expect(api.activeCount.value).toBe(0)
    expect(api.chips.value).toEqual([])
  })

  it('lee los filtros de la URL (sobrevive a recargar la página)', async () => {
    const { api } = await setup('/productos?pocaExistencia=1&tipo=unica&sinCosto=1')

    expect(api.filters.value).toEqual({ ...emptyProductFilters(), pocaExistencia: true, tipo: 'unica', sinCosto: true })
    expect(api.activeCount.value).toBe(3)
    expect(api.chips.value.map((chip) => chip.key)).toEqual(['pocaExistencia', 'tipo', 'sinCosto'])
  })

  it('la URL de la tarjeta de Inicio (?pocaExistencia=1) activa "Poca existencia"', async () => {
    const { api } = await setup('/productos?pocaExistencia=1')

    expect(api.filters.value.pocaExistencia).toBe(true)
    expect(api.chips.value).toEqual([{ key: 'pocaExistencia', label: 'Poca existencia' }])
  })

  it('setFilters escribe en la URL con replace (no llena el historial)', async () => {
    const { api, router } = await setup()
    const before = router.options.history.state.position as number

    await api.setFilters({ ...emptyProductFilters(), agotados: true, tipo: 'cantidad' })

    expect(router.currentRoute.value.query).toEqual({ agotados: '1', tipo: 'cantidad' })
    expect(router.options.history.state.position).toBe(before)
    expect(api.filters.value).toEqual({ ...emptyProductFilters(), agotados: true, tipo: 'cantidad' })
  })

  it('dos cambios seguidos, sin esperar a que la URL se actualice, se acumulan (no se pisan)', async () => {
    const { api, router } = await setup()

    const first = api.setFilters({ ...api.filters.value, agotados: true })
    // El segundo cambio parte de lo que la interfaz ya muestra, aunque `replace` no haya terminado.
    expect(api.filters.value.agotados).toBe(true)
    const second = api.setFilters({ ...api.filters.value, tipo: 'unica' })
    await Promise.all([first, second])

    expect(router.currentRoute.value.query).toEqual({ agotados: '1', tipo: 'unica' })
    expect(api.filters.value).toEqual({ ...emptyProductFilters(), agotados: true, tipo: 'unica' })
  })

  it('si el cambio de URL falla, los filtros vuelven a lo que dice la URL', async () => {
    const { api, router } = await setup('/productos?agotados=1')
    router.replace = () => Promise.reject(new Error('navegación cancelada'))

    await expect(api.setFilters({ ...emptyProductFilters(), sinCosto: true })).rejects.toThrow('navegación cancelada')

    expect(api.filters.value).toEqual({ ...emptyProductFilters(), agotados: true })
  })

  it('apagar todo deja la URL limpia', async () => {
    const { api, router } = await setup('/productos?agotados=1&tipo=unica')

    await api.clearFilters()

    expect(router.currentRoute.value.query).toEqual({})
    expect(api.filters.value).toEqual(emptyProductFilters())
  })

  it('removeFilter quita solo ese filtro', async () => {
    const { api, router } = await setup('/productos?agotados=1&tipo=unica&sinCosto=1')

    await api.removeFilter('tipo')

    expect(router.currentRoute.value.query).toEqual({ agotados: '1', sinCosto: '1' })
  })

  it('no toca parámetros de la URL que no son filtros', async () => {
    const { api, router } = await setup('/productos?ref=inicio&agotados=1')

    await api.setFilters({ ...emptyProductFilters(), sinCosto: true })

    expect(router.currentRoute.value.query).toEqual({ ref: 'inicio', sinCosto: '1' })
  })

  it('"inactivos" se descarta si quien mira no es socio, aunque venga en la URL', async () => {
    const { api, allowInactive } = await setup('/productos?inactivos=1&agotados=1', { allowInactive: false })

    expect(api.filters.value.inactivos).toBe(false)
    expect(api.activeCount.value).toBe(1)

    allowInactive.value = true
    await nextTick()
    expect(api.filters.value.inactivos).toBe(true)
  })

  it('filtersKey solo cambia cuando cambian los filtros, no por otros parámetros de la URL', async () => {
    const { api, router } = await setup('/productos?agotados=1')
    const key = api.filtersKey.value

    await router.replace({ path: '/productos', query: { agotados: '1', ref: 'x' } })
    expect(api.filtersKey.value).toBe(key)

    await api.setFilters({ ...emptyProductFilters(), agotados: true, sinCosto: true })
    expect(api.filtersKey.value).not.toBe(key)
  })

  it('sin router (vista montada sola) guarda los filtros en memoria', async () => {
    const { api } = await setup('/productos', { withRouter: false })

    await api.setFilters({ ...emptyProductFilters(), agotados: true })

    expect(api.filters.value.agotados).toBe(true)
    expect(api.activeCount.value).toBe(1)
    await api.clearFilters()
    expect(api.activeCount.value).toBe(0)
  })
})
