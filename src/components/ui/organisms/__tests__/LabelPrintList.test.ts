import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabelPrintList from '../LabelPrintList.vue'
import { VOICE } from '@/config/voice'

const row = (id: string, name: string, copies: number) => ({ id, name, copies })

describe('LabelPrintList — lista de impresión (D2)', () => {
  it('sin filas muestra el mensaje vacío y ningún resumen', () => {
    const wrapper = mount(LabelPrintList, { props: { rows: [] } })
    expect(wrapper.text()).toContain(VOICE.codigosQr.listEmpty)
    expect(wrapper.find('.label-print-list__summary').exists()).toBe(false)
  })

  it('muestra una fila por producto con su nombre y el conteo de copias', () => {
    const wrapper = mount(LabelPrintList, { props: { rows: [row('p-1', 'Reloj', 2), row('p-2', 'Collar', 1)] } })
    const rows = wrapper.findAll('.label-print-list__row')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('Reloj')
    expect(rows[0].get('.quantity-stepper__value').text()).toBe('2')
  })

  it('+ / − emiten increment/decrement con el id de la fila', async () => {
    const wrapper = mount(LabelPrintList, { props: { rows: [row('p-1', 'Reloj', 2)] } })
    await wrapper.get('[data-action="increment"]').trigger('click')
    expect(wrapper.emitted('increment')).toEqual([['p-1']])
    await wrapper.get('[data-action="decrement"]').trigger('click')
    expect(wrapper.emitted('decrement')).toEqual([['p-1']])
  })

  it('en 1, tocar "−" quita la fila (emite remove) en vez de decrementar a 0', async () => {
    const wrapper = mount(LabelPrintList, { props: { rows: [row('p-1', 'Reloj', 1)] } })
    await wrapper.get('[data-action="decrement"]').trigger('click')
    expect(wrapper.emitted('decrement')).toBeUndefined()
    expect(wrapper.emitted('remove')).toEqual([['p-1']])
  })

  it('"Quitar" saca la fila sin importar el conteo', async () => {
    const wrapper = mount(LabelPrintList, { props: { rows: [row('p-1', 'Reloj', 5)] } })
    const quitar = wrapper.findAll('button').find((b) => b.text() === VOICE.codigosQr.remove)!
    await quitar.trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['p-1']])
  })

  it('resumen: 72 etiquetas -> 1 hoja', () => {
    const wrapper = mount(LabelPrintList, { props: { rows: [row('p-1', 'Reloj', 72)] } })
    expect(wrapper.get('.label-print-list__summary').text()).toBe(VOICE.labels.summary(72, 1))
  })

  it('resumen: 73 etiquetas -> 2 hojas', () => {
    const wrapper = mount(LabelPrintList, { props: { rows: [row('p-1', 'Reloj', 73)] } })
    expect(wrapper.get('.label-print-list__summary').text()).toBe(VOICE.labels.summary(73, 2))
  })

  it('el resumen suma las copias de todas las filas', () => {
    const wrapper = mount(LabelPrintList, { props: { rows: [row('p-1', 'Reloj', 40), row('p-2', 'Collar', 33)] } })
    expect(wrapper.get('.label-print-list__summary').text()).toBe(VOICE.labels.summary(73, 2))
  })
})
