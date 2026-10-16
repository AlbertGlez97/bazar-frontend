import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCart from '../SaleCart.vue'
import source from '../SaleCart.vue?raw'

const line = (productId: string, name: string, extra: Partial<{ quantity: number; unitPriceMinor: number; tipo: 'unica' | 'cantidad'; stockAvailable: number }> = {}) => ({
  productId,
  name,
  unitPriceMinor: 5000,
  quantity: 1,
  tipo: 'cantidad' as 'unica' | 'cantidad',
  stockAvailable: 10,
  image: null,
  ...extra,
})

type Props = InstanceType<typeof SaleCart>['$props']

function mountCart(props: Partial<Props> = {}) {
  return mount(SaleCart, {
    props: {
      lines: [line('a', 'Café'), line('b', 'Pan', { quantity: 2 })],
      itemCount: 3,
      totalMinor: 15000,
      paymentMethod: 'EFECTIVO',
      amountMinor: 0,
      amountText: '',
      changeMinor: 0,
      missingMinor: 15000,
      canCharge: false,
      partial: true,
      loading: false,
      ...props,
    },
    global: { stubs: { teleport: true } },
  })
}

type Wrapper = ReturnType<typeof mountCart>
const chargeBtn = (w: Wrapper) => w.get('button[data-action="charge"]')
const clearBtn = (w: Wrapper) => w.find('button[data-action="clear"]')
const hint = (w: Wrapper) => w.find('.sale-cart__hint')
const amountInput = (w: Wrapper) => w.get('.amount-input input')
const methodButtons = (w: Wrapper) => w.findAll('.payment-method-picker button')
const modalButton = (w: Wrapper, text: string) => w.findAll('button').find((b) => b.text() === text)!

describe('SaleCart — contenido y orden del cobro', () => {
  it('lista cada producto, el total grande, el método, el monto y Cobrar', () => {
    const wrapper = mountCart()

    expect(wrapper.text()).toContain('Café')
    expect(wrapper.text()).toContain('Pan')
    expect(wrapper.get('.cart-summary__total').text()).toBe('$150.00')
    expect(methodButtons(wrapper)).toHaveLength(3)
    expect(wrapper.find('.amount-input input').exists()).toBe(true)
    expect(chargeBtn(wrapper).text()).toBe('Cobrar')
  })

  it('el orden en pantalla, de arriba abajo: N productos, total, método, monto, cambio, Cobrar', () => {
    const wrapper = mountCart()
    const order = ['.sale-cart__lines-wrap', '.cart-summary', '.payment-method-picker', '.amount-input', '.payment-change', 'button[data-action="charge"]']
    const html = wrapper.html()
    const positions = order.map((selector) => {
      const element = wrapper.get(selector).element
      return { selector, index: html.indexOf(element.outerHTML.slice(0, 60).replace(/ data-v-[a-z0-9]+=""/g, '')) }
    })
    // Posición en el documento (más confiable que buscar texto en el HTML).
    const nodes = order.map((selector) => wrapper.get(selector).element)
    for (let i = 1; i < nodes.length; i++) {
      const before = nodes[i - 1]!
      const after = nodes[i]!
      expect(
        before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING,
        `${order[i - 1]} debe ir antes que ${order[i]}`,
      ).toBeTruthy()
    }
    expect(positions.length).toBe(order.length)
  })

  it('la lista es una lista con nombre', () => {
    expect(mountCart().get('ul').attributes('aria-label')).toBe('Productos de la venta')
  })

  it('vacío: muestra un aviso, sin método ni monto ni "Vaciar"', () => {
    const wrapper = mountCart({ lines: [], itemCount: 0, totalMinor: 0, missingMinor: 0 })

    expect(wrapper.text()).toContain('Aquí aparecen los productos')
    expect(wrapper.find('.amount-input').exists()).toBe(false)
    expect(wrapper.find('.payment-method-picker').exists()).toBe(false)
    expect(clearBtn(wrapper).exists()).toBe(false)
  })

  it('no ofrece billetes, monedas ni atajos de efectivo', () => {
    const wrapper = mountCart({ amountText: '100' })

    expect(wrapper.text()).not.toMatch(/billete|moneda|Justo|¿Cómo capturo el efectivo\?/i)
    expect(wrapper.find('details.sale-cart__cash-help').exists()).toBe(false)
  })
})

describe('SaleCart — método y monto', () => {
  it('Efectivo viene elegido y el campo pregunta "¿Cuánto te dan?"', () => {
    const wrapper = mountCart()

    expect(methodButtons(wrapper).map((b) => b.attributes('aria-pressed'))).toEqual(['true', 'false', 'false'])
    expect(wrapper.get('.amount-input label').text()).toBe('¿Cuánto te dan?')
  })

  it.each(['TRANSFERENCIA', 'TARJETA'] as const)('con %s el campo se llama "Monto cobrado"', (paymentMethod) => {
    const wrapper = mountCart({ paymentMethod, amountMinor: 15000, amountText: '150', missingMinor: 0, canCharge: true, partial: false })

    expect(wrapper.get('.amount-input label').text()).toBe('Monto cobrado')
  })

  it('tocar otro método emite update:paymentMethod', async () => {
    const wrapper = mountCart()

    await methodButtons(wrapper)[2]!.trigger('click')

    expect(wrapper.emitted('update:paymentMethod')).toEqual([['TARJETA']])
  })

  it('escribir el monto emite update:amountText con el texto limpio', async () => {
    const wrapper = mountCart()

    await amountInput(wrapper).setValue('$200')

    expect(wrapper.emitted('update:amountText')).toEqual([['200']])
  })

  it('el monto que llega por props se ve en el campo', () => {
    expect((amountInput(mountCart({ amountText: '180' })).element as HTMLInputElement).value).toBe('180')
  })

  it('el cambio sale en verde y grande con efectivo de más', () => {
    const wrapper = mountCart({ amountMinor: 20000, amountText: '200', changeMinor: 5000, missingMinor: 0, canCharge: true, partial: false })

    expect(wrapper.get('.payment-change').attributes('data-state')).toBe('change')
    expect(wrapper.get('.payment-change__amount').text()).toBe('$50.00')
  })

  it.each(['TRANSFERENCIA', 'TARJETA'] as const)('con %s completo no hay cambio', (paymentMethod) => {
    const wrapper = mountCart({ paymentMethod, amountMinor: 15000, amountText: '150', changeMinor: 0, missingMinor: 0, canCharge: true, partial: false })

    expect(wrapper.find('.payment-change__amount').exists()).toBe(false)
    expect(wrapper.text()).not.toMatch(/Cambio/)
  })

  it('un monto menor dice cuánto falta, con separador de miles', () => {
    const wrapper = mountCart({ totalMinor: 150000, amountMinor: 100000, amountText: '1000', missingMinor: 50000 })

    expect(wrapper.get('.payment-change [role="status"]').text()).toBe('Faltan $500.00')
  })
})

describe('SaleCart — botón Cobrar', () => {
  it('sin monto suficiente está deshabilitado', () => {
    expect(chargeBtn(mountCart()).attributes('disabled')).toBeDefined()
  })

  it('carrito vacío: deshabilitado y con su razón', () => {
    const wrapper = mountCart({ lines: [], itemCount: 0, totalMinor: 0, missingMinor: 0 })

    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
    expect(hint(wrapper).text()).toBe('Agrega un producto para poder cobrar.')
  })

  it('con monto suficiente: habilitado, sin razón, y emite charge', async () => {
    const wrapper = mountCart({ amountMinor: 15000, amountText: '150', missingMinor: 0, canCharge: true, partial: false })

    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()
    expect(hint(wrapper).exists()).toBe(false)
    await chargeBtn(wrapper).trigger('click')
    expect(wrapper.emitted('charge')).toHaveLength(1)
  })

  it('deshabilitado no emite charge aunque se toque', async () => {
    const wrapper = mountCart()

    await chargeBtn(wrapper).trigger('click')

    expect(wrapper.emitted('charge')).toBeUndefined()
  })

  it('cobrando: botón bloqueado con "Cobrando…", todo bloqueado y un solo envío', async () => {
    const wrapper = mountCart({ loading: true, canCharge: true, missingMinor: 0, partial: false, amountMinor: 15000, amountText: '150' })

    expect(chargeBtn(wrapper).text()).toContain('Cobrando…')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
    expect(amountInput(wrapper).attributes('disabled')).toBeDefined()
    expect(methodButtons(wrapper).every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    await chargeBtn(wrapper).trigger('click')
    expect(wrapper.emitted('charge')).toBeUndefined()
  })

  it('es el único botón de color fuerte de la pantalla', () => {
    const wrapper = mountCart({ amountMinor: 15000, amountText: '150', missingMinor: 0, canCharge: true, partial: false })

    expect(wrapper.findAll('.app-btn--primary')).toHaveLength(1)
    expect(wrapper.get('.app-btn--primary').attributes('data-action')).toBe('charge')
  })
})

describe('SaleCart — fiado/apartado', () => {
  const one = { lines: [line('a', 'Café')], itemCount: 1, totalMinor: 5000, missingMinor: 5000 }
  const debtButton = (w: Wrapper) => w.find('button[data-action="open-debt-modal"]')
  const onlyOneText = (w: Wrapper) => w.find('.sale-cart__debt-note')

  it('con UNA línea y un monto menor al total (incluido $0, campo vacío) se ofrece', () => {
    const wrapper = mountCart({ ...one, amountMinor: 0, amountText: '', partial: true })

    expect(debtButton(wrapper).exists()).toBe(true)
    expect(debtButton(wrapper).text()).toBe('Registrar como fiado/apartado')
  })

  it('con una línea y un abono parcial de otro método también se ofrece', () => {
    const wrapper = mountCart({ ...one, paymentMethod: 'TARJETA', amountMinor: 2000, amountText: '20', missingMinor: 3000, partial: true })

    expect(debtButton(wrapper).exists()).toBe(true)
  })

  it('tocarlo emite open-debt-modal', async () => {
    const wrapper = mountCart({ ...one, partial: true })

    await debtButton(wrapper).trigger('click')

    expect(wrapper.emitted('open-debt-modal')).toHaveLength(1)
  })

  it('con 2 o más líneas y un monto menor, en vez de nada dice que el fiado es de un solo producto', () => {
    const wrapper = mountCart({ partial: true })

    expect(debtButton(wrapper).exists()).toBe(false)
    expect(onlyOneText(wrapper).text()).toBe('El fiado es de un solo producto por ahora')
  })

  it('con 2 o más líneas y el monto completo no dice nada del fiado', () => {
    const wrapper = mountCart({ amountMinor: 15000, amountText: '150', missingMinor: 0, canCharge: true, partial: false })

    expect(debtButton(wrapper).exists()).toBe(false)
    expect(onlyOneText(wrapper).exists()).toBe(false)
  })

  it('si ya se puede cobrar no se ofrece', () => {
    const wrapper = mountCart({ ...one, amountMinor: 5000, amountText: '50', missingMinor: 0, canCharge: true, partial: false })

    expect(debtButton(wrapper).exists()).toBe(false)
  })

  it('con el carrito vacío no se ofrece ni se explica', () => {
    const wrapper = mountCart({ lines: [], itemCount: 0, totalMinor: 0, missingMinor: 0, partial: false })

    expect(debtButton(wrapper).exists()).toBe(false)
    expect(onlyOneText(wrapper).exists()).toBe(false)
  })

  it('mientras se cobra no se ofrece', () => {
    const wrapper = mountCart({ ...one, loading: true, partial: true })

    expect(debtButton(wrapper).exists()).toBe(false)
  })

  it('no se confunde con Cobrar: es neutro y de alto principal (40 mouse / 48 dedo)', () => {
    expect(source).toMatch(/\.sale-cart__debt-option\s*\{[^}]*min-height:\s*var\(--control-height\)/)
    expect(source).not.toMatch(/\.sale-cart__debt-option\s*\{[^}]*--color-primary\b/)
  })
})

describe('SaleCart — eventos de las líneas', () => {
  it('reenvía increment / decrement / remove con el id del producto', async () => {
    const wrapper = mountCart()
    const secondLine = wrapper.findAll('.cart-line')[1]!

    await secondLine.get('button[data-action="increment"]').trigger('click')
    await secondLine.get('button[data-action="decrement"]').trigger('click')
    await secondLine.get('button[data-action="remove"]').trigger('click')

    expect(wrapper.emitted('increment')).toEqual([['b']])
    expect(wrapper.emitted('decrement')).toEqual([['b']])
    expect(wrapper.emitted('remove')).toEqual([['b']])
  })
})

describe('SaleCart — Vaciar (confirmación segura)', () => {
  it('un toque en "Vaciar" NO vacía: abre la confirmación', async () => {
    const wrapper = mountCart()

    await clearBtn(wrapper).trigger('click')

    expect(wrapper.emitted('clear')).toBeUndefined()
    expect(wrapper.text()).toContain('¿Vaciar la venta?')
  })

  it('la explicación dice qué se pierde y que no se puede deshacer', async () => {
    const wrapper = mountCart()
    await clearBtn(wrapper).trigger('click')

    expect(wrapper.text()).toContain('no se puede deshacer')
  })

  it('"Mejor no" cierra sin vaciar', async () => {
    const wrapper = mountCart()
    await clearBtn(wrapper).trigger('click')

    await modalButton(wrapper, 'Mejor no').trigger('click')

    expect(wrapper.emitted('clear')).toBeUndefined()
    expect(wrapper.text()).not.toContain('¿Vaciar la venta?')
  })

  it('"Sí, vaciar" emite clear y cierra', async () => {
    const wrapper = mountCart()
    await clearBtn(wrapper).trigger('click')

    await modalButton(wrapper, 'Sí, vaciar').trigger('click')

    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('¿Vaciar la venta?')
  })
})

describe('SaleCart — lista de productos colapsable ("N productos ▾")', () => {
  const details = (w: Wrapper) => w.get('details.sale-cart__lines-wrap')

  it('fuera del Paso 2 la lista está abierta', () => {
    expect(details(mountCart()).attributes('open')).toBeDefined()
  })

  it('en el Paso 2 (prominent) arranca cerrada', () => {
    expect(details(mountCart({ prominent: true })).attributes('open')).toBeUndefined()
  })

  it('el resumen dice cuántos productos son, en palabras', () => {
    expect(details(mountCart()).get('summary').text()).toBe('2 productos')
    expect(details(mountCart({ lines: [line('a', 'Café')], itemCount: 1 })).get('summary').text()).toBe('1 producto')
  })

  it('tocar el resumen abre la lista en el Paso 2', async () => {
    const wrapper = mountCart({ prominent: true })

    await details(wrapper).get('summary').trigger('click')
    ;(details(wrapper).element as HTMLDetailsElement).open = true

    expect((details(wrapper).element as HTMLDetailsElement).open).toBe(true)
  })

  it('vacío: no hay <details>', () => {
    expect(mountCart({ lines: [], itemCount: 0 }).find('details').exists()).toBe(false)
  })
})

describe('SaleCart — modo prominente (Paso 2 del cobro en celular)', () => {
  it('lleva la clase de pantalla de cobro solo con la prop', () => {
    expect(mountCart().get('section').classes()).not.toContain('sale-cart--checkout')
    expect(mountCart({ prominent: true }).get('section').classes()).toContain('sale-cart--checkout')
  })

  it('el campo de monto y el método se agrandan (lg)', () => {
    const wrapper = mountCart({ prominent: true })

    expect(wrapper.get('.amount-input').classes()).toContain('amount-input--lg')
    expect(wrapper.get('.segmented-control').classes()).toContain('segmented-control--lg')
  })

  it('muestra lo mismo y Cobrar sigue sin emitir si no se puede', async () => {
    const wrapper = mountCart({ prominent: true })

    await chargeBtn(wrapper).trigger('click')

    expect(wrapper.emitted('charge')).toBeUndefined()
    expect(wrapper.get('section').attributes('aria-label')).toBe('Tu venta')
  })

  describe('contrato de CSS: Cobrar fijo abajo reservando su espacio', () => {
    const style = source.slice(source.indexOf('<style'))
    const rule = (selector: string) => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return style.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] ?? ''
    }

    it('la barra de Cobrar queda fija abajo, con la zona segura del teléfono', () => {
      const actions = rule('.sale-cart--checkout .sale-cart__actions')
      expect(actions).toMatch(/position:\s*fixed/)
      expect(actions).toMatch(/bottom:\s*0/)
      expect(actions).toMatch(/env\(safe-area-inset-bottom/)
    })

    it('el contenido reserva ese espacio con padding inferior para que Cobrar no tape nada', () => {
      const padding = rule('.sale-cart--checkout').match(/padding-bottom:\s*calc\(([^)]*(?:\([^)]*\))?[^)]*)\)/)?.[1] ?? ''
      expect(padding).toMatch(/env\(safe-area-inset-bottom/)
      const rem = Number(/([\d.]+)rem/.exec(padding)?.[1])
      expect(rem).toBeGreaterThanOrEqual(6)
    })

    it('"Cobrar" es el botón más grande de la pantalla (72 px)', () => {
      expect(rule('.sale-cart--checkout .sale-cart__charge')).toMatch(/min-height:\s*4\.5rem/)
    })

    it('en escritorio "Cobrar" va en el flujo (ni sticky ni fijo): nunca queda encima del campo de monto', () => {
      // Regla con ESE selector exacto (no una que solo lo contenga, como la del Paso 2).
      const css = style.replace(/\/\*[\s\S]*?\*\//g, '')
      const exact = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .filter(([, selectors]) => selectors!.split(',').map((part) => part.trim()).includes('.sale-cart__actions'))
        .map(([, , body]) => body)
        .join(';')
      expect(exact).not.toBe('')
      expect(exact).not.toMatch(/position:\s*(sticky|fixed|absolute)/)
    })

    it('en escritorio, si no caben los productos, solo LA LISTA se desplaza: total, método, monto, cambio y Cobrar quedan a la vista', () => {
      const cart = rule('.sale-cart:not(.sale-cart--checkout)')
      expect(cart).toMatch(/min-height:\s*0/)
      expect(cart).toMatch(/flex:\s*1 1 auto/)
      const wrap = rule('.sale-cart:not(.sale-cart--checkout) .sale-cart__lines-wrap')
      expect(wrap).toMatch(/overflow-y:\s*auto/)
      expect(wrap).toMatch(/min-height:\s*0/)
      expect(wrap).toMatch(/flex:\s*0 1 auto/)
      expect(rule('.sale-cart:not(.sale-cart--checkout) .sale-cart__payment')).toMatch(/flex-shrink:\s*0/)
      expect(rule('.sale-cart:not(.sale-cart--checkout) .sale-cart__actions')).toMatch(/flex-shrink:\s*0/)
    })

    it('el espaciado de escritorio es compacto (8 px) para que todo quepa sin desplazarse', () => {
      expect(rule('.sale-cart:not(.sale-cart--checkout)')).toMatch(/gap:\s*var\(--spacing-sm\)/)
      expect(rule('.sale-cart:not(.sale-cart--checkout) .sale-cart__payment')).toMatch(/gap:\s*var\(--spacing-sm\)/)
    })
  })

  it('en escritorio el total y el cambio van compactos; en el Paso 2 siguen grandes', () => {
    const desktop = mountCart()
    expect(desktop.get('.cart-summary').classes()).toContain('cart-summary--compact')
    expect(desktop.get('.payment-change').classes()).toContain('payment-change--compact')

    const step2 = mountCart({ prominent: true })
    expect(step2.get('.cart-summary').classes()).not.toContain('cart-summary--compact')
    expect(step2.get('.payment-change').classes()).not.toContain('payment-change--compact')
  })
})
