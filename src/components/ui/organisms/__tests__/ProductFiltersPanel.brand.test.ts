// Filtro por marca en el panel "Filtros" de Productos.
import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductFiltersPanel from '../ProductFiltersPanel.vue'
import { emptyProductFilters } from '@/utils/product-filters'
import type { ProductFilters } from '@/types/product-filters.types'

afterEach(() => { document.body.innerHTML = '' })

function mountPanel(filters: Partial<ProductFilters> = {}, props: Record<string, unknown> = {}) {
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
type Wrapper = ReturnType<typeof mountPanel>
async function open(wrapper: Wrapper) {
  await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
  return wrapper
}
const brandInput = (wrapper: Wrapper) => {
  const label = wrapper.findAll('label').find((l) => l.text().startsWith('Marca'))
  if (!label) throw new Error('No hay campo Marca')
  return wrapper.get(`[id="${label.attributes('for')}"]`)
}
const lastFilters = (wrapper: Wrapper) => wrapper.emitted('update:filters')!.at(-1)![0] as ProductFilters

describe('ProductFiltersPanel — marca', () => {
  it('tiene un campo Marca con su etiqueta, también para quien no es socio', async () => {
    const wrapper = await open(mountPanel({}, { showInactive: false }))

    expect(brandInput(wrapper).element.tagName).toBe('INPUT')
  })

  it('escribir no filtra todavía: se aplica al terminar (change), para no pedir en cada letra', async () => {
    const wrapper = await open(mountPanel())

    // Teclear dispara solo `input` (VTU.setValue dispara también `change`, que es justo la confirmación).
    const field = brandInput(wrapper)
    ;(field.element as HTMLInputElement).value = 'Nik'
    await field.trigger('input')

    expect(wrapper.emitted('update:filters')).toBeUndefined()
  })

  it('al confirmar (change) emite el filtro con la marca limpia', async () => {
    const wrapper = await open(mountPanel())
    await brandInput(wrapper).setValue('  Casa   Vieja ')

    await brandInput(wrapper).trigger('change')

    expect(lastFilters(wrapper).marca).toBe('Casa Vieja')
  })

  it('vaciar el campo y confirmar quita el filtro', async () => {
    const wrapper = await open(mountPanel({ marca: 'Nike' }))
    await brandInput(wrapper).setValue('   ')

    await brandInput(wrapper).trigger('change')

    expect(lastFilters(wrapper).marca).toBeUndefined()
  })

  it('arranca con la marca ya filtrada', async () => {
    const wrapper = await open(mountPanel({ marca: 'Nike' }))

    expect((brandInput(wrapper).element as HTMLInputElement).value).toBe('Nike')
  })

  it('si el filtro cambia desde fuera (se quitó el chip), el campo se actualiza', async () => {
    const wrapper = await open(mountPanel({ marca: 'Nike' }))

    await wrapper.setProps({ filters: emptyProductFilters() })

    expect((brandInput(wrapper).element as HTMLInputElement).value).toBe('')
  })

  it('cuenta como filtro activo en la insignia del botón', () => {
    const wrapper = mountPanel({ marca: 'Nike' })

    expect(wrapper.get('button[aria-haspopup="dialog"]').attributes('aria-label')).toBe('Filtros, 1 filtro activo')
  })

  it('"Limpiar filtros" también la quita', async () => {
    const wrapper = await open(mountPanel({ marca: 'Nike' }))

    await wrapper.findAll('button').find((b) => b.text() === 'Limpiar filtros')!.trigger('click')

    expect(lastFilters(wrapper).marca).toBeUndefined()
  })

  it('combina con los otros filtros sin pisarlos', async () => {
    const wrapper = await open(mountPanel({ agotados: true }))
    await brandInput(wrapper).setValue('Nike')

    await brandInput(wrapper).trigger('change')

    expect(lastFilters(wrapper)).toMatchObject({ agotados: true, marca: 'Nike' })
  })

  it('un interruptor tampoco pierde la marca ya aplicada', async () => {
    const wrapper = await open(mountPanel({ marca: 'Nike' }))

    await wrapper.findAll('.filter-switch-row').find((r) => r.text().includes('Agotados'))!.get('input').setValue(true)

    expect(lastFilters(wrapper)).toMatchObject({ agotados: true, marca: 'Nike' })
  })

  it('ofrece las marcas conocidas como sugerencias', async () => {
    const wrapper = await open(mountPanel({}, { brandSuggestions: ['Adidas', 'Nike'] }))
    const list = brandInput(wrapper).attributes('list')!

    expect(wrapper.findAll(`[id="${list}"] option`).map((o) => o.attributes('value'))).toEqual(['Adidas', 'Nike'])
  })
})
