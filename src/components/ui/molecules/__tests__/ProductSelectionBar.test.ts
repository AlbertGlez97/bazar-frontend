import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductSelectionBar from '../ProductSelectionBar.vue'
import { VOICE } from '@/config/voice'

const base = { active: false, count: 0, selectingAll: false, progress: null }
const button = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll('button').find((b) => b.text().includes(label))

describe('ProductSelectionBar', () => {
  it('fuera del modo selección solo ofrece "Seleccionar"', async () => {
    const wrapper = mount(ProductSelectionBar, { props: base })
    expect(wrapper.findAll('button').map((b) => b.text())).toEqual([VOICE.labels.select])
    await button(wrapper, VOICE.labels.select)!.trigger('click')
    expect(wrapper.emitted('enter')).toHaveLength(1)
  })

  it('en modo selección muestra el contador, "Seleccionar todos", "Limpiar" y "Salir"', () => {
    const wrapper = mount(ProductSelectionBar, { props: { ...base, active: true, count: 3 } })
    expect(wrapper.text()).toContain('3 seleccionados')
    expect(button(wrapper, VOICE.labels.selectAll)).toBeTruthy()
    expect(button(wrapper, VOICE.labels.clear)).toBeTruthy()
    expect(button(wrapper, VOICE.labels.exitSelection)).toBeTruthy()
  })

  it('el contador va en singular con uno y avisa a los lectores de pantalla (aria-live)', () => {
    const wrapper = mount(ProductSelectionBar, { props: { ...base, active: true, count: 1 } })
    const counter = wrapper.find('[aria-live]')
    expect(counter.exists()).toBe(true)
    expect(counter.text()).toBe('1 seleccionado')
  })

  it('"Imprimir códigos QR" aparece SOLO con al menos un producto seleccionado', async () => {
    const none = mount(ProductSelectionBar, { props: { ...base, active: true, count: 0 } })
    expect(button(none, VOICE.labels.print)).toBeUndefined()
    const some = mount(ProductSelectionBar, { props: { ...base, active: true, count: 2 } })
    await button(some, VOICE.labels.print)!.trigger('click')
    expect(some.emitted('print')).toHaveLength(1)
  })

  it('"Limpiar selección" está deshabilitado sin nada seleccionado', () => {
    const wrapper = mount(ProductSelectionBar, { props: { ...base, active: true, count: 0 } })
    expect(button(wrapper, VOICE.labels.clear)!.attributes('disabled')).toBeDefined()
  })

  it('emite select-all, clear y exit', async () => {
    const wrapper = mount(ProductSelectionBar, { props: { ...base, active: true, count: 2 } })
    await button(wrapper, VOICE.labels.selectAll)!.trigger('click')
    await button(wrapper, VOICE.labels.clear)!.trigger('click')
    await button(wrapper, VOICE.labels.exitSelection)!.trigger('click')
    expect(wrapper.emitted('select-all')).toHaveLength(1)
    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('exit')).toHaveLength(1)
  })

  it('mientras selecciona todos: progreso visible y "Seleccionar todos" deshabilitado', () => {
    const wrapper = mount(ProductSelectionBar, { props: { ...base, active: true, count: 100, selectingAll: true, progress: { loaded: 100, total: 250 } } })
    expect(wrapper.text()).toContain(VOICE.labels.selectingAll(100, 250))
    const all = wrapper.findAll('button').find((b) => b.text().includes('Seleccionando') || b.text().includes(VOICE.labels.selectAll))!
    expect(all.attributes('disabled')).toBeDefined()
  })

  it('no permite imprimir ni limpiar mientras carga "todos" (la selección aún está cambiando)', () => {
    const wrapper = mount(ProductSelectionBar, { props: { ...base, active: true, count: 100, selectingAll: true, progress: { loaded: 100, total: 250 } } })
    expect(button(wrapper, VOICE.labels.print)!.attributes('disabled')).toBeDefined()
    expect(button(wrapper, VOICE.labels.clear)!.attributes('disabled')).toBeDefined()
  })
})
