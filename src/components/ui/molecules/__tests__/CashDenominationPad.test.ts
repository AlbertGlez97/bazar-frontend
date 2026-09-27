import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CashDenominationPad, { BILLS } from '../CashDenominationPad.vue'

function mountPad(props: { counts?: Partial<Record<number, number>>; disabled?: boolean } = {}) {
  return mount(CashDenominationPad, { props: { counts: {}, ...props } })
}

const buttons = (w: ReturnType<typeof mountPad>) => w.findAll('.cash-denomination-pad__btn')

describe('CashDenominationPad — botones', () => {
  it('renderiza un botón por cada billete, en el orden de BILLS', () => {
    const wrapper = mountPad()
    expect(BILLS).toEqual([20, 50, 100, 200, 500, 1000])
    expect(buttons(wrapper).map((b) => b.text().replace(/×\d+/, '').trim())).toEqual(
      BILLS.map((bill) => `$${bill}`),
    )
    for (const btn of buttons(wrapper)) expect(btn.attributes('type')).toBe('button')
  })

  it('un toque emite "tap" con la denominación correcta', async () => {
    const wrapper = mountPad()
    await buttons(wrapper)[3].trigger('click') // $200
    expect(wrapper.emitted('tap')).toEqual([[200]])
  })

  it('sin toques no muestra insignia de cantidad', () => {
    const wrapper = mountPad({ counts: {} })
    expect(wrapper.find('.cash-denomination-pad__badge').exists()).toBe(false)
  })

  it('con cuenta > 0 muestra una insignia de texto "×N" en el billete correspondiente', () => {
    const wrapper = mountPad({ counts: { 200: 2 } })
    const btn200 = buttons(wrapper)[3]
    expect(btn200.get('.cash-denomination-pad__badge').text()).toBe('×2')
    // Los demás billetes, sin toques, no tienen insignia.
    expect(buttons(wrapper)[0].find('.cash-denomination-pad__badge').exists()).toBe(false)
  })

  it('el nombre accesible incluye la cantidad acumulada', () => {
    const wrapper = mountPad({ counts: { 200: 3 } })
    expect(buttons(wrapper)[3].attributes('aria-label')).toContain('$200')
    expect(buttons(wrapper)[3].attributes('aria-label')).toContain('3')
    expect(buttons(wrapper)[0].attributes('aria-label')).toContain('$20')
    expect(buttons(wrapper)[0].attributes('aria-label')).not.toMatch(/\d+ veces/)
  })

  it('disabled desactiva todos los botones', () => {
    const wrapper = mountPad({ disabled: true })
    for (const btn of buttons(wrapper)) expect(btn.attributes('disabled')).toBeDefined()
  })

  it('no hay ícono genérico de billete/dinero (identidad = color + número)', () => {
    const wrapper = mountPad()
    expect(wrapper.findAll('svg')).toHaveLength(0)
  })
})
