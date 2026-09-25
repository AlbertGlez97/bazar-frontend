import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CartSummary from '../CartSummary.vue'

type Props = InstanceType<typeof CartSummary>['$props']

function mountSummary(props: Partial<Props> = {}) {
  return mount(CartSummary, {
    props: { itemCount: 2, totalMinor: 15000, cashMinor: 0, changeMinor: 0, missingMinor: 0, ...props },
  })
}

const status = (w: ReturnType<typeof mountSummary>) => w.get('.cart-summary__status')

describe('CartSummary — total', () => {
  it('muestra el total grande con dos decimales exactos (1999 -> $19.99)', () => {
    const wrapper = mountSummary({ totalMinor: 1999 })
    expect(wrapper.get('.cart-summary__total').text()).toBe('$19.99')
  })

  it('cuenta las piezas en singular y plural', () => {
    expect(mountSummary({ itemCount: 1 }).text()).toContain('1 pieza')
    expect(mountSummary({ itemCount: 3 }).text()).toContain('3 piezas')
  })
})

describe('CartSummary — estados', () => {
  it('vacío: invita a tocar un producto y no habla de efectivo', () => {
    const wrapper = mountSummary({ itemCount: 0, totalMinor: 0 })
    expect(wrapper.get('.cart-summary').attributes('data-state')).toBe('empty')
    expect(status(wrapper).text()).toBe('Toca un producto para empezar.')
    expect(wrapper.get('.cart-summary__total').text()).toBe('$0.00')
  })

  it('sin efectivo todavía: pregunta con cuánto pagan', () => {
    const wrapper = mountSummary({ cashMinor: 0, totalMinor: 15000, missingMinor: 15000 })
    expect(wrapper.get('.cart-summary').attributes('data-state')).toBe('no-cash')
    expect(status(wrapper).text()).toBe('Escribe cuánto te dan.')
  })

  it('falta dinero: dice cuánto falta, exacto', () => {
    const wrapper = mountSummary({ cashMinor: 10000, totalMinor: 15050, missingMinor: 5050 })
    expect(wrapper.get('.cart-summary').attributes('data-state')).toBe('missing')
    expect(status(wrapper).text()).toContain('Faltan $50.50')
    expect(wrapper.text()).toContain('Recibido $100.00')
  })

  it('alcanza: muestra el efectivo y el cambio a entregar grande', () => {
    const wrapper = mountSummary({ cashMinor: 20000, totalMinor: 15050, changeMinor: 4950 })
    expect(wrapper.get('.cart-summary').attributes('data-state')).toBe('ok')
    expect(wrapper.get('.cart-summary__change').text()).toContain('$49.50')
    expect(status(wrapper).text()).toContain('Cambio')
    expect(wrapper.text()).toContain('Recibido $200.00')
  })

  it('efectivo justo: dice "Justo, sin cambio" y no muestra un cambio de $0.00', () => {
    const wrapper = mountSummary({ cashMinor: 15000, totalMinor: 15000, changeMinor: 0 })
    expect(wrapper.get('.cart-summary').attributes('data-state')).toBe('ok')
    expect(status(wrapper).text()).toBe('Justo, sin cambio.')
    expect(wrapper.find('.cart-summary__change').exists()).toBe(false)
  })

  it('un producto de precio 0 con efectivo 0 se puede cobrar: estado ok, sin cambio', () => {
    const wrapper = mountSummary({ itemCount: 1, totalMinor: 0, cashMinor: 0, changeMinor: 0 })
    expect(wrapper.get('.cart-summary').attributes('data-state')).toBe('ok')
    expect(status(wrapper).text()).toBe('Justo, sin cambio.')
  })

  it('el estado se anuncia en una región viva educada', () => {
    const wrapper = mountSummary()
    expect(status(wrapper).attributes('role')).toBe('status')
    expect(status(wrapper).attributes('aria-live')).toBe('polite')
  })

  it('el texto de "falta" no depende solo del color: lleva palabras', () => {
    const wrapper = mountSummary({ cashMinor: 100, totalMinor: 5000, missingMinor: 4900 })
    expect(status(wrapper).text()).toMatch(/Faltan/)
  })
})
