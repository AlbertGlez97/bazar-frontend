import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CashDenominationPad, { BILLS, COINS } from '../CashDenominationPad.vue'

function mountPad(props: { counts?: Partial<Record<number, number>>; disabled?: boolean } = {}) {
  return mount(CashDenominationPad, { props: { counts: {}, ...props } })
}

const buttons = (w: ReturnType<typeof mountPad>) => w.findAll('.cash-denomination-pad__btn')
const billButtons = (w: ReturnType<typeof mountPad>) => w.findAll('.cash-denomination-pad__btn--bill')
const coinButtons = (w: ReturnType<typeof mountPad>) => w.findAll('.cash-denomination-pad__btn--coin')

describe('CashDenominationPad — billetes', () => {
  it('renderiza un botón por cada billete, en el orden de BILLS', () => {
    const wrapper = mountPad()
    expect(BILLS).toEqual([20, 50, 100, 200, 500, 1000])
    expect(billButtons(wrapper).map((b) => b.text().replace(/×\d+/, '').trim())).toEqual(
      BILLS.map((bill) => `$${bill}`),
    )
    for (const btn of billButtons(wrapper)) expect(btn.attributes('type')).toBe('button')
  })

  it('un toque emite "tap" con la denominación correcta', async () => {
    const wrapper = mountPad()
    await billButtons(wrapper)[3].trigger('click') // $200
    expect(wrapper.emitted('tap')).toEqual([[200]])
  })

  it('sin toques no muestra insignia de cantidad', () => {
    const wrapper = mountPad({ counts: {} })
    expect(wrapper.find('.cash-denomination-pad__badge').exists()).toBe(false)
  })

  it('con cuenta > 0 muestra una insignia de texto "×N" en el billete correspondiente', () => {
    const wrapper = mountPad({ counts: { 200: 2 } })
    const btn200 = billButtons(wrapper)[3]
    expect(btn200.get('.cash-denomination-pad__badge').text()).toBe('×2')
    // Los demás billetes, sin toques, no tienen insignia.
    expect(billButtons(wrapper)[0].find('.cash-denomination-pad__badge').exists()).toBe(false)
  })

  it('el nombre accesible incluye la cantidad acumulada, en masculino ("agregado")', () => {
    const wrapper = mountPad({ counts: { 200: 3 } })
    expect(billButtons(wrapper)[3].attributes('aria-label')).toBe('Billete de $200, agregado 3 veces')
    expect(billButtons(wrapper)[0].attributes('aria-label')).toBe('Billete de $20')
  })
})

describe('CashDenominationPad — monedas', () => {
  it('expone COINS como $1/$2/$5/$10, junto a BILLS', () => {
    expect(COINS).toEqual([1, 2, 5, 10])
  })

  it('renderiza un botón redondo por cada moneda, en el orden de COINS', () => {
    const wrapper = mountPad()
    expect(coinButtons(wrapper).map((b) => b.text().replace(/×\d+/, '').trim())).toEqual(
      COINS.map((coin) => `$${coin}`),
    )
    for (const btn of coinButtons(wrapper)) expect(btn.attributes('type')).toBe('button')
  })

  it('el total de botones es billetes + monedas (6 + 4 = 10)', () => {
    expect(buttons(mountPad())).toHaveLength(10)
  })

  it('tocar una moneda emite "tap" con su denominación', async () => {
    const wrapper = mountPad()
    const coin5 = coinButtons(wrapper).find((b) => b.text().startsWith('$5'))!
    await coin5.trigger('click')
    expect(wrapper.emitted('tap')).toEqual([[5]])
  })

  it('con cuenta > 0 muestra la insignia "×N" en la moneda correspondiente (acumula, p. ej. $5 x3)', () => {
    const wrapper = mountPad({ counts: { 5: 3 } })
    const coin5 = coinButtons(wrapper).find((b) => b.text().startsWith('$5'))!
    expect(coin5.get('.cash-denomination-pad__badge').text()).toBe('×3')
  })

  it('el nombre accesible usa género femenino: "Moneda de $X, agregada N veces"', () => {
    const wrapper = mountPad({ counts: { 5: 2 } })
    const coin5 = coinButtons(wrapper).find((b) => b.text().startsWith('$5'))!
    expect(coin5.attributes('aria-label')).toBe('Moneda de $5, agregada 2 veces')
    const coin1 = coinButtons(wrapper).find((b) => b.text().startsWith('$1'))!
    expect(coin1.attributes('aria-label')).toBe('Moneda de $1')
  })

  it('la moneda de $10 es bimetálica: clase modificadora distinta a $1/$2/$5', () => {
    const wrapper = mountPad()
    const coin10 = coinButtons(wrapper).find((b) => b.text().startsWith('$10'))!
    const coin5 = coinButtons(wrapper).find((b) => b.text().startsWith('$5'))!
    expect(coin10.classes()).toContain('cash-denomination-pad__btn--coin-bimetallic')
    expect(coin5.classes()).toContain('cash-denomination-pad__btn--coin-silver')
    expect(coin5.classes()).not.toContain('cash-denomination-pad__btn--coin-bimetallic')
  })
})

describe('CashDenominationPad — agrupación visible', () => {
  it('muestra los encabezados "Billetes" y "Monedas" como texto visible (en el árbol de accesibilidad, no solo CSS)', () => {
    const wrapper = mountPad()
    const headings = wrapper.findAll('h3').map((h) => h.text())
    expect(headings).toEqual(['Billetes', 'Monedas'])
  })
})

describe('CashDenominationPad — comportamiento común', () => {
  it('disabled desactiva todos los botones (billetes y monedas)', () => {
    const wrapper = mountPad({ disabled: true })
    for (const btn of buttons(wrapper)) expect(btn.attributes('disabled')).toBeDefined()
  })

  it('no hay ícono genérico de billete/moneda en ninguna denominación (identidad = color/forma + número)', () => {
    const wrapper = mountPad()
    expect(wrapper.findAll('svg')).toHaveLength(0)
  })
})
