import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFiltersPanel from '../ProductFiltersPanel.vue'
import { emptyProductFilters } from '@/utils/product-filters'
import type { ProductFilters } from '@/types/product-filters.types'

type Wrapper = ReturnType<typeof mountPanel>

function mountPanel(filters: Partial<ProductFilters> = {}, props: { showInactive?: boolean } = {}) {
  const wrapper = mount(ProductFiltersPanel, {
    props: {
      filters: { ...emptyProductFilters(), ...filters },
      showInactive: true,
      ...props,
      'onUpdate:filters': (next: ProductFilters) => wrapper.setProps({ filters: next }),
    },
    attachTo: document.body,
  })
  return wrapper
}

const trigger = (wrapper: Wrapper) => wrapper.get('button[aria-haspopup="dialog"]')
async function open(wrapper: Wrapper) {
  await trigger(wrapper).trigger('click')
  return wrapper
}
const rowInput = (wrapper: Wrapper, label: string) => {
  const row = wrapper.findAll('.filter-switch-row').find((r) => r.text().includes(label))
  if (!row) throw new Error(`No hay fila "${label}"`)
  return row.get('input')
}
const lastFilters = (wrapper: Wrapper) => wrapper.emitted('update:filters')!.at(-1)![0] as ProductFilters

afterEach(() => { document.body.innerHTML = '' })

describe('ProductFiltersPanel', () => {
  describe('botón "Filtros"', () => {
    it('se llama Filtros y arranca cerrado (aria-expanded=false)', () => {
      const wrapper = mountPanel()

      expect(trigger(wrapper).text()).toContain('Filtros')
      expect(trigger(wrapper).attributes('aria-expanded')).toBe('false')
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('sin filtros activos no muestra insignia', () => {
      const wrapper = mountPanel()

      expect(wrapper.find('.product-filters-panel__count').exists()).toBe(false)
      wrapper.unmount()
    })

    it('con filtros activos la insignia lleva el número y el botón lo dice a lectores de pantalla', () => {
      const wrapper = mountPanel({ agotados: true, tipo: 'unica', sinCosto: true })

      expect(wrapper.get('.product-filters-panel__count').text()).toBe('3')
      expect(trigger(wrapper).attributes('aria-label')).toBe('Filtros, 3 filtros activos')
      wrapper.unmount()
    })

    it('con un solo filtro dice "1 filtro activo" en singular', () => {
      const wrapper = mountPanel({ agotados: true })

      expect(trigger(wrapper).attributes('aria-label')).toBe('Filtros, 1 filtro activo')
      wrapper.unmount()
    })

    it('abre el panel y aria-expanded pasa a true', async () => {
      const wrapper = await open(mountPanel())

      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      expect(trigger(wrapper).attributes('aria-expanded')).toBe('true')
      wrapper.unmount()
    })
  })

  describe('contenido del panel', () => {
    it('agrupa las filas: Existencia, Estado, Tipo, Costo y Marca', async () => {
      const wrapper = await open(mountPanel())

      const groups = wrapper.findAll('fieldset')
      expect(groups.map((g) => g.get('legend').text())).toEqual(['Existencia', 'Estado', 'Tipo', 'Costo', 'Marca'])
      expect(groups[0]!.text()).toContain('Poca existencia')
      expect(groups[0]!.text()).toContain('Agotados')
      expect(groups[1]!.text()).toContain('Mostrar inactivos')
      expect(groups[2]!.text()).toContain('Única')
      expect(groups[2]!.text()).toContain('Por cantidad')
      expect(groups[3]!.text()).toContain('Sin costo de compra')
      wrapper.unmount()
    })

    it('"Mostrar inactivos" solo se ofrece a socios: sin showInactive no hay grupo Estado', async () => {
      const wrapper = await open(mountPanel({}, { showInactive: false }))

      expect(wrapper.text()).not.toContain('Mostrar inactivos')
      expect(wrapper.findAll('legend').map((l) => l.text())).toEqual(['Existencia', 'Tipo', 'Costo', 'Marca'])
      wrapper.unmount()
    })

    it('cada interruptor refleja el filtro activo', async () => {
      const wrapper = await open(mountPanel({ pocaExistencia: true, tipo: 'cantidad', sinCosto: true }))

      expect((rowInput(wrapper, 'Poca existencia').element as HTMLInputElement).checked).toBe(true)
      expect((rowInput(wrapper, 'Agotados').element as HTMLInputElement).checked).toBe(false)
      expect((rowInput(wrapper, 'Por cantidad').element as HTMLInputElement).checked).toBe(true)
      expect((rowInput(wrapper, 'Única').element as HTMLInputElement).checked).toBe(false)
      expect((rowInput(wrapper, 'Sin costo de compra').element as HTMLInputElement).checked).toBe(true)
      wrapper.unmount()
    })
  })

  describe('el filtro se aplica al cambiar cada interruptor', () => {
    it.each([
      ['Poca existencia', { pocaExistencia: true }],
      ['Agotados', { agotados: true }],
      ['Mostrar inactivos', { inactivos: true }],
      ['Única', { tipo: 'unica' }],
      ['Por cantidad', { tipo: 'cantidad' }],
      ['Sin costo de compra', { sinCosto: true }],
    ])('encender "%s" emite el filtro de inmediato', async (label, expected) => {
      const wrapper = await open(mountPanel())

      await rowInput(wrapper, label).setValue(true)

      expect(lastFilters(wrapper)).toEqual({ ...emptyProductFilters(), ...expected })
      wrapper.unmount()
    })

    it('apagar un filtro lo quita y conserva los demás', async () => {
      const wrapper = await open(mountPanel({ agotados: true, sinCosto: true }))

      await rowInput(wrapper, 'Agotados').setValue(false)

      expect(lastFilters(wrapper)).toEqual({ ...emptyProductFilters(), sinCosto: true })
      wrapper.unmount()
    })

    it('Única y Por cantidad son excluyentes: encender una apaga la otra', async () => {
      const wrapper = await open(mountPanel({ tipo: 'unica' }))

      await rowInput(wrapper, 'Por cantidad').setValue(true)

      expect(lastFilters(wrapper).tipo).toBe('cantidad')
      wrapper.unmount()
    })

    it('apagar el tipo activo deja el tipo sin filtrar', async () => {
      const wrapper = await open(mountPanel({ tipo: 'unica' }))

      await rowInput(wrapper, 'Única').setValue(false)

      expect(lastFilters(wrapper).tipo).toBeUndefined()
      wrapper.unmount()
    })

    it('el panel sigue abierto después de cambiar un filtro', async () => {
      const wrapper = await open(mountPanel())

      await rowInput(wrapper, 'Agotados').setValue(true)

      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('Limpiar filtros', () => {
    const clearButton = (wrapper: Wrapper) => wrapper.findAll('button').find((b) => b.text() === 'Limpiar filtros')!

    it('restablece todo con un solo evento', async () => {
      const wrapper = await open(mountPanel({ pocaExistencia: true, agotados: true, inactivos: true, tipo: 'unica', sinCosto: true }))

      await clearButton(wrapper).trigger('click')

      expect(lastFilters(wrapper)).toEqual(emptyProductFilters())
      wrapper.unmount()
    })

    it('está deshabilitado cuando no hay nada que limpiar', async () => {
      const wrapper = await open(mountPanel())

      expect(clearButton(wrapper).attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })
  })

  describe('cierre', () => {
    it('Escape cierra el panel', async () => {
      const wrapper = await open(mountPanel())

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('un clic fuera cierra el panel', async () => {
      const wrapper = await open(mountPanel())
      await wrapper.vm.$nextTick()

      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('el botón de cerrar del panel lo cierra', async () => {
      const wrapper = await open(mountPanel())

      await wrapper.get('[aria-label="Cerrar filtros"]').trigger('click')

      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
