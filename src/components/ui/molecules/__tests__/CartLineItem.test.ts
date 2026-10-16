import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CartLineItem from '../CartLineItem.vue'
import source from '../CartLineItem.vue?raw'

const line = {
  productId: 'p-1',
  name: 'Café de olla',
  unitPriceMinor: 1999,
  quantity: 3,
  tipo: 'cantidad' as 'unica' | 'cantidad',
  stockAvailable: 10,
  image: null as string | null,
}

function mountLine(overrides: Partial<typeof line> = {}, props: { disabled?: boolean } = {}) {
  return mount(CartLineItem, { props: { line: { ...line, ...overrides }, ...props } })
}

describe('CartLineItem — contenido', () => {
  it('muestra nombre, precio unitario y subtotal exacto (3 x 19.99 = 59.97, sin errores de flotante)', () => {
    const wrapper = mountLine()
    expect(wrapper.text()).toContain('Café de olla')
    expect(wrapper.get('.cart-line__unit').text()).toContain('$19.99')
    expect(wrapper.get('.cart-line__subtotal').text()).toBe('$59.97')
  })

  it('el subtotal usa enteros: 1999 x 1 = 19.99 y precio 0 da 0.00', () => {
    expect(mountLine({ quantity: 1 }).get('.cart-line__subtotal').text()).toBe('$19.99')
    expect(mountLine({ unitPriceMinor: 0 }).get('.cart-line__subtotal').text()).toBe('$0.00')
  })

  it('subtotales grandes siguen exactos', () => {
    // 0.10 x 3 en flotante da 0.30000000000000004: aquí en centavos enteros
    expect(mountLine({ unitPriceMinor: 10, quantity: 3 }).get('.cart-line__subtotal').text()).toBe('$0.30')
    // 1.10 x 3 en flotante da 3.3000000000000003
    expect(mountLine({ unitPriceMinor: 110, quantity: 3 }).get('.cart-line__subtotal').text()).toBe('$3.30')
    expect(mountLine({ unitPriceMinor: 29950, quantity: 2 }).get('.cart-line__subtotal').text()).toBe('$599.00')
  })

  it('sin imagen usa un marcador decorativo; con imagen la muestra con alt vacío (el nombre ya está en texto)', () => {
    expect(mountLine().find('img').exists()).toBe(false)
    expect(mountLine().get('.cart-line__placeholder').attributes('aria-hidden')).toBe('true')

    const withImage = mountLine({ image: '/uploads/products/a.png' })
    expect(withImage.get('img').attributes('src')).toBe('/uploads/products/a.png')
    expect(withImage.get('img').attributes('alt')).toBe('')
  })
})

describe('CartLineItem — cantidad', () => {
  it('un producto por cantidad muestra el stepper con tope en su existencia', async () => {
    const wrapper = mountLine({ quantity: 10, stockAvailable: 10 })
    const plus = wrapper.get('button[data-action="increment"]')
    expect(plus.attributes('aria-disabled')).toBe('true')
  })

  it('reenvía increment, decrement y el límite alcanzado', async () => {
    const wrapper = mountLine({ quantity: 2 })
    await wrapper.get('button[data-action="increment"]').trigger('click')
    await wrapper.get('button[data-action="decrement"]').trigger('click')
    expect(wrapper.emitted('increment')).toHaveLength(1)
    expect(wrapper.emitted('decrement')).toHaveLength(1)

    const atMin = mountLine({ quantity: 1 })
    await atMin.get('button[data-action="decrement"]').trigger('click')
    expect(atMin.emitted('limit')).toEqual([['min']])
  })

  it('una pieza única no muestra stepper: dice "Pieza única"', () => {
    const wrapper = mountLine({ tipo: 'unica', quantity: 1, stockAvailable: 1 })
    expect(wrapper.find('.quantity-stepper').exists()).toBe(false)
    expect(wrapper.text()).toContain('Pieza única')
  })
})

describe('CartLineItem — quitar', () => {
  it('el botón "Quitar" tiene nombre accesible con el producto, texto visible y emite remove', async () => {
    const wrapper = mountLine()
    const remove = wrapper.get('button[data-action="remove"]')
    expect(remove.attributes('aria-label')).toBe('Quitar Café de olla')
    expect(remove.text()).toContain('Quitar')
    expect(remove.attributes('type')).toBe('button')

    await remove.trigger('click')
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('el ícono del botón es decorativo', () => {
    expect(mountLine().find('button[data-action="remove"] [aria-hidden="true"]').exists()).toBe(true)
  })
})

describe('CartLineItem — bloqueado mientras se cobra', () => {
  it('disabled deshabilita quitar y el stepper', async () => {
    const wrapper = mountLine({}, { disabled: true })
    expect(wrapper.get('button[data-action="remove"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[data-action="increment"]').attributes('disabled')).toBeDefined()
    await wrapper.get('button[data-action="remove"]').trigger('click')
    expect(wrapper.emitted('remove')).toBeUndefined()
  })
})

describe('CartLineItem — línea compacta (escritorio ~110 px)', () => {
  const css = source.slice(source.indexOf('<style')).replace(/<style[^>]*>/, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const rule = (selector: string) =>
    [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes(selector))
      .map(([, , body]) => body)
      .join(';')

  it('contador a la izquierda y "Quitar" a la derecha, en la MISMA fila', () => {
    const wrapper = mountLine()
    const row = wrapper.get('.cart-line__controls')
    const children = [...row.element.children]

    expect(children[0]!.classList.contains('quantity-stepper')).toBe(true)
    expect(children.at(-1)!.getAttribute('data-action')).toBe('remove')
    expect(rule('.cart-line__controls')).toMatch(/justify-content:\s*space-between/)
    expect(rule('.cart-line__controls')).toMatch(/flex-wrap:\s*nowrap/)
  })

  it('"Quitar" conserva texto e ícono pero es discreto: sin relleno rojo ni caja pesada', () => {
    const remove = rule('.cart-line__remove')
    expect(remove).toMatch(/background:\s*transparent/)
    expect(remove).not.toMatch(/--color-danger-soft/)
    expect(remove).toMatch(/border:\s*(0|none)/)
    expect(remove).toMatch(/min-height:\s*var\(--control-height-compact\)/)
  })

  it('el nombre ocupa 2 líneas como máximo', () => {
    const name = rule('.cart-line__name')
    expect(name).toMatch(/-webkit-line-clamp:\s*2/)
    expect(name).toMatch(/overflow:\s*hidden/)
  })

  it('el precio c/u va junto al subtotal (columna derecha), no como una fila más debajo del nombre', () => {
    const wrapper = mountLine()
    expect(wrapper.get('.cart-line__amounts .cart-line__unit').text()).toContain('c/u')
    expect(wrapper.get('.cart-line__amounts .cart-line__subtotal').text()).toBe('$59.97')
    expect(wrapper.find('.cart-line__controls .cart-line__unit').exists()).toBe(false)
  })

  it('miniatura de 3.5 rem y poco aire: la línea queda cerca de 110 px', () => {
    expect(rule('.cart-line__media')).toMatch(/width:\s*3\.5rem/)
    expect(rule('.cart-line__media')).toMatch(/height:\s*3\.5rem/)
    expect(rule('.cart-line')).toMatch(/padding:\s*0\.75rem var\(--spacing-md\)/)
  })

  it('el contador del carrito es la pastilla neutra de tamaño md (token compacto), no la "lg" de 56 px', () => {
    const wrapper = mountLine()
    expect(wrapper.get('.quantity-stepper').classes()).toContain('quantity-stepper--md')
  })
})
