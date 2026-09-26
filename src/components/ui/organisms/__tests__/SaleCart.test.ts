import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleCart from '../SaleCart.vue'

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
      cashMinor: 0,
      changeMinor: 0,
      missingMinor: 15000,
      canCharge: false,
      cashText: '',
      loading: false,
      ...props,
    },
    global: { stubs: { teleport: true } },
  })
}

const chargeBtn = (w: ReturnType<typeof mountCart>) => w.get('button[data-action="charge"]')
const clearBtn = (w: ReturnType<typeof mountCart>) => w.find('button[data-action="clear"]')
const hint = (w: ReturnType<typeof mountCart>) => w.find('.sale-cart__hint')
const modalButton = (w: ReturnType<typeof mountCart>, text: string) => w.findAll('button').find((b) => b.text() === text)!

describe('SaleCart — contenido', () => {
  it('lista cada producto, el resumen con el total y el campo de efectivo', () => {
    const wrapper = mountCart()
    expect(wrapper.findAll('.cart-line')).toHaveLength(2)
    expect(wrapper.get('.cart-summary__total').text()).toBe('$150.00')
    expect(wrapper.find('.cash-input input').exists()).toBe(true)
  })

  it('la lista es una lista con nombre', () => {
    const list = mountCart().get('ul')
    expect(list.attributes('aria-label')).toBe('Productos de la venta')
  })

  it('vacío: muestra un aviso, sin campo de efectivo ni "Vaciar"', () => {
    const wrapper = mountCart({ lines: [], itemCount: 0, totalMinor: 0, missingMinor: 0 })
    expect(wrapper.text()).toContain('Aquí aparecen los productos que agregues.')
    expect(wrapper.find('.cash-input').exists()).toBe(false)
    expect(clearBtn(wrapper).exists()).toBe(false)
    expect(wrapper.findAll('.cart-line')).toHaveLength(0)
  })
})

describe('SaleCart — botón Cobrar', () => {
  it('sin efectivo suficiente está deshabilitado y explica por qué', () => {
    const wrapper = mountCart({ cashMinor: 0, canCharge: false })
    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
    expect(hint(wrapper).text()).toBe('Escribe el efectivo recibido para poder cobrar.')
  })

  it('efectivo corto: dice cuánto falta', () => {
    const wrapper = mountCart({ cashMinor: 10000, missingMinor: 5000 })
    expect(hint(wrapper).text()).toBe('Faltan $50.00 para poder cobrar.')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
  })

  it('carrito vacío: deshabilitado con su razón', () => {
    const wrapper = mountCart({ lines: [], itemCount: 0, totalMinor: 0, missingMinor: 0 })
    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
    expect(hint(wrapper).text()).toBe('Agrega un producto para poder cobrar.')
  })

  it('listo para cobrar: habilitado, sin línea de razón, y emite charge', async () => {
    const wrapper = mountCart({ cashMinor: 20000, changeMinor: 5000, missingMinor: 0, canCharge: true })
    expect(chargeBtn(wrapper).attributes('disabled')).toBeUndefined()
    expect(hint(wrapper).exists()).toBe(false)
    expect(chargeBtn(wrapper).text()).toBe('Cobrar')

    await chargeBtn(wrapper).trigger('click')
    expect(wrapper.emitted('charge')).toHaveLength(1)
  })

  it('deshabilitado no emite charge aunque se toque', async () => {
    const wrapper = mountCart({ canCharge: false })
    await chargeBtn(wrapper).trigger('click')
    expect(wrapper.emitted('charge')).toBeUndefined()
  })

  it('cobrando: botón bloqueado con "Cobrando…", controles bloqueados y un solo envío', async () => {
    const wrapper = mountCart({ cashMinor: 20000, missingMinor: 0, canCharge: true, loading: true })
    expect(chargeBtn(wrapper).text()).toContain('Cobrando…')
    expect(chargeBtn(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.get('.cash-input input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('button[data-action="remove"]').attributes('disabled')).toBeDefined()
    expect(clearBtn(wrapper).attributes('disabled')).toBeDefined()

    await chargeBtn(wrapper).trigger('click')
    expect(wrapper.emitted('charge')).toBeUndefined()
  })

  it('el botón principal es grande (clase de 56 px)', () => {
    expect(chargeBtn(mountCart()).classes()).toContain('sale-cart__charge')
  })
})

describe('SaleCart — eventos de las líneas y el efectivo', () => {
  it('reenvía increment / decrement / remove con el id del producto', async () => {
    const wrapper = mountCart()
    const secondLine = wrapper.findAll('.cart-line')[1]
    await secondLine.get('button[data-action="increment"]').trigger('click')
    await secondLine.get('button[data-action="decrement"]').trigger('click')
    await secondLine.get('button[data-action="remove"]').trigger('click')

    expect(wrapper.emitted('increment')).toEqual([['b']])
    expect(wrapper.emitted('decrement')).toEqual([['b']])
    expect(wrapper.emitted('remove')).toEqual([['b']])
  })

  it('reenvía el límite alcanzado con producto y tipo', async () => {
    const wrapper = mountCart({ lines: [line('a', 'Café', { quantity: 1 })] })
    await wrapper.get('button[data-action="decrement"]').trigger('click')
    expect(wrapper.emitted('limit')).toEqual([['a', 'min']])
  })

  it('escribir efectivo emite update:cashText con el texto limpio', async () => {
    const wrapper = mountCart()
    await wrapper.get('.cash-input input').setValue('$200')
    expect(wrapper.emitted('update:cashText')).toEqual([['200']])
  })

  it('un atajo de billete emite por el mismo camino', async () => {
    const wrapper = mountCart()
    const chip = wrapper.findAll('.cash-input__chip').find((c) => c.text() === '$200')!
    await chip.trigger('click')
    expect(wrapper.emitted('update:cashText')).toEqual([['200']])
  })

  it('el efectivo que llega por props se ve en el campo', () => {
    const wrapper = mountCart({ cashText: '180' })
    expect((wrapper.get('.cash-input input').element as HTMLInputElement).value).toBe('180')
  })
})

describe('SaleCart — Vaciar (confirmación segura)', () => {
  it('un toque en "Vaciar" NO vacía: abre la confirmación', async () => {
    const wrapper = mountCart()
    expect(wrapper.text()).not.toContain('¿Vaciar la venta?')

    await clearBtn(wrapper).trigger('click')

    expect(wrapper.text()).toContain('¿Vaciar la venta?')
    expect(wrapper.emitted('clear')).toBeUndefined()
  })

  it('la explicación dice qué se pierde y que no se puede deshacer', async () => {
    const wrapper = mountCart()
    await clearBtn(wrapper).trigger('click')
    expect(wrapper.text()).toMatch(/quitar todos los productos/i)
    expect(wrapper.text()).toMatch(/no se puede deshacer/i)
  })

  it('"Mejor no" cierra sin vaciar (es la opción principal, la segura)', async () => {
    const wrapper = mountCart()
    await clearBtn(wrapper).trigger('click')
    await modalButton(wrapper, 'Mejor no').trigger('click')

    expect(wrapper.text()).not.toContain('¿Vaciar la venta?')
    expect(wrapper.emitted('clear')).toBeUndefined()
  })

  it('"Sí, vaciar" emite clear y cierra', async () => {
    const wrapper = mountCart()
    await clearBtn(wrapper).trigger('click')
    await modalButton(wrapper, 'Sí, vaciar').trigger('click')

    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('¿Vaciar la venta?')
  })

  it('la confirmación tiene dos salidas del mismo tamaño y sin la X pequeña', async () => {
    const wrapper = mountCart()
    await clearBtn(wrapper).trigger('click')
    expect(wrapper.find('.app-modal__close').exists()).toBe(false)
    expect(modalButton(wrapper, 'Mejor no').classes()).toContain('app-btn--lg')
    expect(modalButton(wrapper, 'Sí, vaciar').classes()).toContain('app-btn--lg')
  })
})

// `prominent` = Paso 2 del cobro en celular: solo cambia la presentación (CSS);
// el contenido, los eventos y la accesibilidad son exactamente los mismos.
describe('SaleCart — modo prominente (Paso 2 del cobro)', () => {
  it('sin la prop no lleva la clase de pantalla de cobro', () => {
    expect(mountCart().get('.sale-cart').classes()).not.toContain('sale-cart--checkout')
    expect(mountCart({ prominent: false }).get('.sale-cart').classes()).not.toContain('sale-cart--checkout')
  })

  it('con la prop lleva la clase que agranda el total y el efectivo', () => {
    expect(mountCart({ prominent: true }).get('.sale-cart').classes()).toContain('sale-cart--checkout')
  })

  it('muestra lo mismo: líneas, total, efectivo y Cobrar', () => {
    const wrapper = mountCart({ prominent: true })
    expect(wrapper.findAll('.cart-line')).toHaveLength(2)
    expect(wrapper.get('.cart-summary__total').text()).toBe('$150.00')
    expect(wrapper.find('.cash-input input').exists()).toBe(true)
    expect(chargeBtn(wrapper).text()).toBe('Cobrar')
  })

  it('conserva el nombre accesible y el aviso de por qué no se puede cobrar', () => {
    const wrapper = mountCart({ prominent: true })
    expect(wrapper.get('.sale-cart').attributes('aria-label')).toBe('Tu venta')
    expect(hint(wrapper).exists()).toBe(true)
  })

  it('Cobrar sigue sin emitir si no se puede cobrar, y emite una vez si se puede', async () => {
    const blocked = mountCart({ prominent: true, canCharge: false })
    await chargeBtn(blocked).trigger('click')
    expect(blocked.emitted('charge')).toBeUndefined()

    const ready = mountCart({ prominent: true, canCharge: true })
    await chargeBtn(ready).trigger('click')
    expect(ready.emitted('charge')).toHaveLength(1)
  })

  it('el efectivo sigue emitiendo el texto tal cual, sin adivinar', async () => {
    const wrapper = mountCart({ prominent: true })
    await wrapper.get('.cash-input input').setValue('100.5')
    expect(wrapper.emitted('update:cashText')?.at(-1)).toEqual(['100.5'])
  })
})
