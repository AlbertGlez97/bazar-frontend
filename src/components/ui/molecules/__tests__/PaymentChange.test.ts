import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentChange from '../PaymentChange.vue'
import source from '../PaymentChange.vue?raw'

type Props = {
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA'
  itemCount: number
  totalMinor: number
  amountMinor: number
  changeMinor: number
  missingMinor: number
}
const base: Props = { paymentMethod: 'EFECTIVO', itemCount: 1, totalMinor: 110000, amountMinor: 0, changeMinor: 0, missingMinor: 110000 }
const mountChange = (overrides: Partial<Props> = {}) => mount(PaymentChange, { props: { ...base, ...overrides } })

describe('PaymentChange — cambio o lo que falta', () => {
  describe('EFECTIVO', () => {
    it('sin nada escrito pide el monto, con palabras sencillas', () => {
      const wrapper = mountChange()

      expect(wrapper.get('[role="status"]').text()).toBe('Escribe cuánto te dan.')
      expect(wrapper.get('.payment-change').attributes('data-state')).toBe('no-amount')
    })

    it('menor al total dice cuánto falta, con separador de miles', () => {
      const wrapper = mountChange({ amountMinor: 100000, missingMinor: 10000 })

      expect(wrapper.get('[role="status"]').text()).toBe('Faltan $100.00')
      expect(wrapper.get('.payment-change').attributes('data-state')).toBe('missing')
    })

    it('mayor al total muestra el "Cambio" grande', () => {
      const wrapper = mountChange({ amountMinor: 150000, changeMinor: 40000, missingMinor: 0 })

      expect(wrapper.get('.payment-change__label').text()).toBe('Cambio')
      expect(wrapper.get('.payment-change__amount').text()).toBe('$400.00')
      expect(wrapper.get('.payment-change').attributes('data-state')).toBe('change')
    })

    it('exacto dice que no hay cambio', () => {
      const wrapper = mountChange({ amountMinor: 110000, changeMinor: 0, missingMinor: 0 })

      expect(wrapper.get('[role="status"]').text()).toBe('Justo, sin cambio.')
      expect(wrapper.get('.payment-change').attributes('data-state')).toBe('exact')
    })

    it('un total de $0 no pide nada', () => {
      const wrapper = mountChange({ totalMinor: 0, amountMinor: 0, missingMinor: 0 })

      expect(wrapper.get('.payment-change').attributes('data-state')).toBe('exact')
    })
  })

  describe.each(['TRANSFERENCIA', 'TARJETA'] as const)('%s', (paymentMethod) => {
    it('con el total completo no hay cambio ni nada que mostrar', () => {
      const wrapper = mountChange({ paymentMethod, amountMinor: 110000, changeMinor: 0, missingMinor: 0 })

      expect(wrapper.find('.payment-change__amount').exists()).toBe(false)
      expect(wrapper.text()).not.toMatch(/Cambio/)
      expect(wrapper.get('.payment-change').attributes('data-state')).toBe('none')
    })

    it('con un monto menor al total dice cuánto falta', () => {
      const wrapper = mountChange({ paymentMethod, amountMinor: 30000, missingMinor: 80000 })

      expect(wrapper.get('[role="status"]').text()).toBe('Faltan $800.00')
      expect(wrapper.get('.payment-change').attributes('data-state')).toBe('missing')
    })

    it('con el monto vacío dice cuánto falta (todo el total)', () => {
      const wrapper = mountChange({ paymentMethod, amountMinor: 0, missingMinor: 110000 })

      expect(wrapper.get('[role="status"]').text()).toBe('Faltan $1,100.00')
    })
  })

  it('con el carrito vacío no dibuja nada', () => {
    const wrapper = mountChange({ itemCount: 0, totalMinor: 0, missingMinor: 0 })

    expect(wrapper.get('.payment-change').attributes('data-state')).toBe('empty')
    expect(wrapper.text()).toBe('')
  })

  it('es una región viva educada: cada cambio de estado se anuncia sin mover el foco', () => {
    const wrapper = mountChange()

    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
  })

  describe('contrato de CSS', () => {
    const style = source.slice(source.indexOf('<style'))
    const rule = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return style.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? ''
    }

    it('el cambio es grande y verde (con texto y borde, no solo color)', () => {
      expect(rule(".payment-change[data-state='change']")).toMatch(/color:\s*var\(--color-success\)/)
      expect(rule(".payment-change[data-state='change'] .payment-change__live")).toMatch(/border-left:\s*6px solid var\(--color-success\)/)
      expect(rule('.payment-change__amount')).toMatch(/font-size:\s*clamp\(\s*1\.5rem,\s*11cqi,\s*3\.5rem\s*\)/)
    })

    it('el monto del cambio tampoco se sale de su tarjeta', () => {
      const amount = rule('.payment-change__amount')
      expect(amount).toMatch(/max-width:\s*100%/)
      expect(amount).toMatch(/white-space:\s*nowrap/)
      expect(rule('.payment-change')).toMatch(/container-type:\s*inline-size/)
    })
  })
})
