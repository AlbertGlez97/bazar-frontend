import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCart from '../SaleCart.vue'
import CartLineItem from '../../molecules/CartLineItem.vue'
import CartSummary from '../../molecules/CartSummary.vue'

// Regla de negocio (E0): los cambios de precio y los descuentos están BLOQUEADOS.
// El contrato de la API lo dice ("No hay descuentos ni cancelaciones") y la venta
// se cobra siempre al precio del catálogo. El resumen de "Tu venta" no debe ofrecer
// "cambiar precio" ni nada equivalente: el precio unitario se muestra como texto.
//
// Estas pruebas FIJAN esa regla para que nadie agregue el control por accidente. Si
// algún día se define una función real de cambio de precio o descuento, debe ser su
// propia tarea (con su regla de negocio, su permiso y su contrato en la API) y estas
// pruebas se actualizan a propósito, no se borran.

const PRICE_CHANGE_WORDS = /precio|descuento|rebaja|oferta|cambiar|editar|modificar|ajustar/i

const line = (productId: string, name: string, extra: Record<string, unknown> = {}) => ({
  productId,
  name,
  unitPriceMinor: 5000,
  quantity: 2,
  tipo: 'cantidad' as const,
  stockAvailable: 10,
  image: null,
  ...extra,
})

function mountCart(prominent = false) {
  return mount(SaleCart, {
    props: {
      lines: [line('a', 'Café'), line('b', 'Radio vintage', { tipo: 'unica', quantity: 1, unitPriceMinor: 45000 })],
      itemCount: 3,
      totalMinor: 55000,
      cashMinor: 60000,
      changeMinor: 5000,
      missingMinor: 0,
      canCharge: true,
      cashText: '600',
      loading: false,
      prominent,
    },
    global: { stubs: { teleport: true } },
  })
}

describe.each([['normal', false], ['prominente (Paso 2)', true]] as const)('el carrito de venta no ofrece cambiar el precio — %s', (_label, prominent) => {
  it('ningún botón habla de precio, descuento, cambiar, editar o modificar', () => {
    const wrapper = mountCart(prominent)
    const labels = wrapper.findAll('button').flatMap((b) => [b.text(), b.attributes('aria-label') ?? '', b.attributes('title') ?? ''])
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect(label, `botón "${label}"`).not.toMatch(PRICE_CHANGE_WORDS)
    }
  })

  it('el único campo de texto es el del efectivo: no hay campos de precio ni de descuento', () => {
    const wrapper = mountCart(prominent)
    const inputs = wrapper.findAll('input')
    expect(inputs).toHaveLength(1)
    expect(inputs[0].element.closest('.cash-input')).not.toBeNull()
    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
  })

  it('el precio unitario de cada línea es texto plano: no es un botón, un enlace ni un campo', () => {
    const wrapper = mountCart(prominent)
    const units = wrapper.findAll('.cart-line__unit')
    expect(units).toHaveLength(2)
    for (const unit of units) {
      expect(unit.element.tagName).toBe('P')
      expect(unit.find('button, a, input, select, [tabindex], [role="button"]').exists()).toBe(false)
      expect(unit.attributes('tabindex')).toBeUndefined()
      expect(unit.text()).toMatch(/^\$[\d.]+ c\/u$/)
    }
  })

  it('las líneas y el resumen no ofrecen más acciones que las de siempre', () => {
    const wrapper = mountCart(prominent)
    const lineActions = wrapper.findAll('.cart-line button').map((b) => b.attributes('data-action') ?? b.attributes('aria-label') ?? b.text())
    for (const action of lineActions) expect(action).not.toMatch(PRICE_CHANGE_WORDS)
    expect(wrapper.find('.cart-summary button, .cart-summary input').exists()).toBe(false)
  })

  it('el total sale del precio del catálogo: no hay forma de tocarlo desde la pantalla', () => {
    const wrapper = mountCart(prominent)
    const total = wrapper.get('.cart-summary__total')
    expect(total.element.tagName).toBe('SPAN')
    expect(total.find('button, input, a').exists()).toBe(false)
  })
})

describe('el carrito solo emite las acciones permitidas', () => {
  it('SaleCart declara únicamente los eventos de siempre (sin evento de precio ni de descuento)', () => {
    const declared = ((SaleCart as unknown as { emits?: string[] }).emits ?? []).slice().sort()
    expect(declared).toEqual(['charge', 'clear', 'decrement', 'increment', 'limit', 'remove', 'update:cashText'])
    for (const event of declared) expect(event).not.toMatch(PRICE_CHANGE_WORDS)
  })

  it('CartLineItem declara solo más, menos, quitar y límite', () => {
    const declared = ((CartLineItem as unknown as { emits?: string[] }).emits ?? []).slice().sort()
    expect(declared).toEqual(['decrement', 'increment', 'limit', 'remove'])
  })

  it('CartSummary no declara eventos: solo muestra', () => {
    const declared = (CartSummary as unknown as { emits?: string[] }).emits ?? []
    expect(declared).toEqual([])
  })
})
