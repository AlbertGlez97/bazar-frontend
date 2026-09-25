import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCartStore } from '../cart.store'
import type { CartProductInput } from '../cart.store'
import { minorToDisplay } from '@/utils/money'

function product(overrides: Partial<CartProductInput> = {}): CartProductInput {
  return {
    id: 'p-1',
    name: 'Taza de barro',
    unitPriceMinor: 1999,
    tipo: 'cantidad',
    stock: 10,
    image: null,
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('cart.store — agregar', () => {
  it('agrega un producto con el snapshot de lo que vio quien vende', () => {
    const cart = useCartStore()
    const result = cart.add(product({ image: '/uploads/products/x.png' }))

    expect(result).toEqual({ ok: true })
    expect(cart.lines).toEqual([
      {
        productId: 'p-1', name: 'Taza de barro', unitPriceMinor: 1999, quantity: 1,
        tipo: 'cantidad', stockAvailable: 10, image: '/uploads/products/x.png',
      },
    ])
  })

  it('cantidad: cada add suma 1 hasta el stock local y luego se rechaza con max-stock', () => {
    const cart = useCartStore()
    const item = product({ stock: 2 })

    expect(cart.add(item)).toEqual({ ok: true })
    expect(cart.add(item)).toEqual({ ok: true })
    expect(cart.add(item)).toEqual({ ok: false, reason: 'max-stock' })
    expect(cart.lines[0].quantity).toBe(2)
  })

  it('unica: se agrega una vez; volver a agregarla no cambia nada y avisa already-in-cart', () => {
    const cart = useCartStore()
    const item = product({ id: 'u-1', tipo: 'unica', stock: 1 })

    expect(cart.add(item)).toEqual({ ok: true })
    expect(cart.add(item)).toEqual({ ok: false, reason: 'already-in-cart' })
    expect(cart.lines).toHaveLength(1)
    expect(cart.lines[0].quantity).toBe(1)
  })

  it('sin existencia (stock 0) no se agrega: out-of-stock', () => {
    const cart = useCartStore()
    expect(cart.add(product({ stock: 0 }))).toEqual({ ok: false, reason: 'out-of-stock' })
    expect(cart.add(product({ tipo: 'unica', stock: 0 }))).toEqual({ ok: false, reason: 'out-of-stock' })
    expect(cart.isEmpty).toBe(true)
  })

  it('un stock negativo o no entero (dato corrupto) también es out-of-stock', () => {
    const cart = useCartStore()
    expect(cart.add(product({ stock: -3 }))).toEqual({ ok: false, reason: 'out-of-stock' })
    expect(cart.add(product({ stock: Number.NaN }))).toEqual({ ok: false, reason: 'out-of-stock' })
  })

  it('no supera las 100000 piezas por línea aunque el stock sea mayor (límite del contrato)', () => {
    const cart = useCartStore()
    const item = product({ stock: 500000 })
    cart.add(item)
    cart.setQuantity('p-1', 100000)
    expect(cart.lines[0].quantity).toBe(100000)
    expect(cart.increment('p-1')).toEqual({ ok: false, reason: 'max-stock' })
  })

  it('no admite más de 500 productos distintos (límite del contrato)', () => {
    const cart = useCartStore()
    for (let i = 0; i < 500; i++) {
      expect(cart.add(product({ id: `p-${i}` }))).toEqual({ ok: true })
    }
    expect(cart.add(product({ id: 'p-500' }))).toEqual({ ok: false, reason: 'cart-full' })
    // Un producto que ya está sí puede subir de cantidad
    expect(cart.add(product({ id: 'p-0' }))).toEqual({ ok: true })
  })
})

describe('cart.store — cantidades', () => {
  it('increment respeta el stock local', () => {
    const cart = useCartStore()
    cart.add(product({ stock: 2 }))

    expect(cart.increment('p-1')).toEqual({ ok: true })
    expect(cart.lines[0].quantity).toBe(2)
    expect(cart.increment('p-1')).toEqual({ ok: false, reason: 'max-stock' })
  })

  it('increment de una unica siempre es max-stock (solo hay una)', () => {
    const cart = useCartStore()
    cart.add(product({ id: 'u-1', tipo: 'unica', stock: 1 }))
    expect(cart.increment('u-1')).toEqual({ ok: false, reason: 'max-stock' })
  })

  it('decrement baja de uno en uno y en 1 se queda en 1 (min-quantity): quitar es explícito con remove', () => {
    const cart = useCartStore()
    cart.add(product())
    cart.increment('p-1')

    expect(cart.decrement('p-1')).toEqual({ ok: true })
    expect(cart.lines[0].quantity).toBe(1)
    expect(cart.decrement('p-1')).toEqual({ ok: false, reason: 'min-quantity' })
    expect(cart.lines[0].quantity).toBe(1)
  })

  it('increment, decrement y remove de un producto que no está: not-in-cart', () => {
    const cart = useCartStore()
    expect(cart.increment('nope')).toEqual({ ok: false, reason: 'not-in-cart' })
    expect(cart.decrement('nope')).toEqual({ ok: false, reason: 'not-in-cart' })
    expect(cart.remove('nope')).toEqual({ ok: false, reason: 'not-in-cart' })
  })

  it('setQuantity fija la cantidad (tope: stock) y rechaza valores inválidos', () => {
    const cart = useCartStore()
    cart.add(product({ stock: 5 }))

    expect(cart.setQuantity('p-1', 4)).toEqual({ ok: true })
    expect(cart.lines[0].quantity).toBe(4)
    expect(cart.setQuantity('p-1', 6)).toEqual({ ok: false, reason: 'max-stock' })
    expect(cart.lines[0].quantity).toBe(4)
    expect(cart.setQuantity('p-1', 0)).toEqual({ ok: false, reason: 'min-quantity' })
    expect(cart.setQuantity('p-1', 1.5)).toEqual({ ok: false, reason: 'min-quantity' })
    expect(cart.lines[0].quantity).toBe(4)
  })

  it('remove quita la línea completa sin importar la cantidad', () => {
    const cart = useCartStore()
    cart.add(product({ id: 'a' }))
    cart.add(product({ id: 'b' }))
    cart.increment('a')

    expect(cart.remove('a')).toEqual({ ok: true })
    expect(cart.lines.map((l) => l.productId)).toEqual(['b'])
  })

  it('clear vacía las líneas y el efectivo (venta nueva)', () => {
    const cart = useCartStore()
    cart.add(product())
    cart.setCashFromDisplay('100')

    cart.clear()

    expect(cart.lines).toEqual([])
    expect(cart.cashReceivedMinor).toBe(0)
    expect(cart.isEmpty).toBe(true)
  })
})

describe('cart.store — dinero exacto (enteros en centavos)', () => {
  it('3 × 19.99 = 59.97 exacto (con flotantes daría 59.96999...)', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 1999, stock: 10 }))
    cart.increment('p-1')
    cart.increment('p-1')

    expect(cart.totalMinor).toBe(5997)
    expect(Number.isInteger(cart.totalMinor)).toBe(true)
  })

  it('0.10 + 0.20 suma 30 centavos exactos', () => {
    const cart = useCartStore()
    cart.add(product({ id: 'a', unitPriceMinor: 10 }))
    cart.add(product({ id: 'b', unitPriceMinor: 20 }))
    expect(cart.totalMinor).toBe(30)
  })

  it('suma varias líneas con distintas cantidades', () => {
    const cart = useCartStore()
    cart.add(product({ id: 'a', unitPriceMinor: 12550, stock: 5 }))
    cart.increment('a')
    cart.add(product({ id: 'b', unitPriceMinor: 333, stock: 5 }))

    expect(cart.totalMinor).toBe(2 * 12550 + 333)
    expect(cart.itemCount).toBe(3)
  })

  it('cantidades grandes siguen exactas', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 1999, stock: 99999 }))
    cart.setQuantity('p-1', 99999)
    expect(cart.totalMinor).toBe(1999 * 99999)
  })

  it('cambio exacto: 100.00 recibidos por 59.97 = 40.03', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 1999, stock: 10 }))
    cart.setQuantity('p-1', 3)
    cart.setCashFromDisplay('100')

    expect(cart.cashReceivedMinor).toBe(10000)
    expect(cart.changeMinor).toBe(4003)
    expect(cart.missingMinor).toBe(0)
    expect(cart.canCharge).toBe(true)
  })

  it('efectivo insuficiente: faltan centavos exactos y no se puede cobrar', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 1999 }))
    cart.setCashFromDisplay('19.98')

    expect(cart.missingMinor).toBe(1)
    expect(cart.changeMinor).toBe(0)
    expect(cart.canCharge).toBe(false)
  })

  it('efectivo exacto: cambio 0 y se puede cobrar', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 1999 }))
    cart.setCashFromDisplay('19.99')

    expect(cart.changeMinor).toBe(0)
    expect(cart.missingMinor).toBe(0)
    expect(cart.canCharge).toBe(true)
  })

  it('producto de precio 0 con efectivo 0 es válido (contrato §6)', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 0 }))

    expect(cart.totalMinor).toBe(0)
    expect(cart.cashReceivedMinor).toBe(0)
    expect(cart.canCharge).toBe(true)
  })

  it('carrito vacío no se puede cobrar aunque el efectivo sea cualquiera', () => {
    const cart = useCartStore()
    expect(cart.canCharge).toBe(false)
    cart.setCashFromDisplay('500')
    expect(cart.canCharge).toBe(false)
    expect(cart.totalMinor).toBe(0)
    expect(cart.itemCount).toBe(0)
  })

  it('un total que no cabe en el máximo de efectivo del contrato nunca es cobrable', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 2147483647, stock: 10 }))
    cart.setQuantity('p-1', 2)
    cart.setCashMinor(2147483647)
    expect(cart.canCharge).toBe(false)
  })

  it('500 pagados por una compra de 299.50: el cambio es 200.50 exacto', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 29950 }))
    cart.setCashFromDisplay('500')

    expect(cart.totalMinor).toBe(29950)
    expect(cart.changeMinor).toBe(20050)
    expect(minorToDisplay(cart.changeMinor)).toBe('200.50')
    expect(cart.missingMinor).toBe(0)
  })

  it('el faltante también es exacto: 299.50 con 100 pagados faltan 199.50', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 29950 }))
    cart.setCashFromDisplay('100')

    expect(cart.missingMinor).toBe(19950)
    expect(cart.changeMinor).toBe(0)
    expect(cart.canCharge).toBe(false)
  })

  it('0.10 + 0.20 suma 0.30 exacto (en pesos flotantes da 0.30000000000000004)', () => {
    const cart = useCartStore()
    cart.add(product({ id: 'a', unitPriceMinor: 10 }))
    cart.add(product({ id: 'b', unitPriceMinor: 20 }))
    expect(cart.totalMinor).toBe(30)
  })

  it('3 × 1.10 suma 3.30 exacto (en pesos flotantes da 3.3000000000000003)', () => {
    const cart = useCartStore()
    cart.add(product({ id: 'c', unitPriceMinor: 110, stock: 10 }))
    cart.setQuantity('c', 3)
    expect(cart.totalMinor).toBe(330)
  })

  it('un carrito imposible (más que enteros exactos) no rompe la pantalla: el total queda "demasiado grande" y no se cobra', () => {
    const cart = useCartStore()
    for (let i = 0; i < 500; i += 1) {
      cart.add(product({ id: `p-${i}`, unitPriceMinor: 2147483647, stock: 100000, tipo: 'cantidad' }))
      cart.setQuantity(`p-${i}`, 100000)
    }

    expect(() => cart.totalMinor).not.toThrow()
    expect(cart.totalMinor).toBeGreaterThan(2147483647)
    expect(cart.canCharge).toBe(false)
    expect(() => cart.changeMinor).not.toThrow()
    expect(() => cart.missingMinor).not.toThrow()
  })
})

describe('cart.store — efectivo capturado como texto', () => {
  it.each([
    ['100', 10000],
    ['100.5', 10050],
    ['1,000', 100000],
    ['1,000.50', 100050],
    ['1000', 100000],
    ['1000.5', 100050],
    ['  100.50  ', 10050],
    ['0.10', 10],
    ['$100', 10000],
    ['', 0],
  ])('setCashFromDisplay(%j) -> %i centavos y es un monto válido', (text, expected) => {
    const cart = useCartStore()
    cart.setCashFromDisplay(text)
    expect(cart.cashReceivedMinor).toBe(expected)
    expect(cart.cashInvalid).toBe(false)
  })

  it.each(['abc', '1e5', '-20', '100,50', '1,5', '1.2.3', '1.000,50', '10.005'])(
    'setCashFromDisplay(%j) es ambiguo o inválido: efectivo 0 y marcado como inválido',
    (text) => {
      const cart = useCartStore()
      cart.setCashMinor(5000)
      cart.setCashFromDisplay(text)
      expect(cart.cashReceivedMinor).toBe(0)
      expect(cart.cashInvalid).toBe(true)
    },
  )

  it('un texto ambiguo bloquea el cobro aunque el total sea 0 (no se adivina el monto)', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 0 }))
    expect(cart.canCharge).toBe(true)

    cart.setCashFromDisplay('1,5')
    expect(cart.canCharge).toBe(false)
  })

  it('"1,000" alcanza para un total de $1,000.00 (la coma agrupa miles)', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 100000 }))
    cart.setCashFromDisplay('1,000')
    expect(cart.cashReceivedMinor).toBe(100000)
    expect(cart.canCharge).toBe(true)
    expect(cart.changeMinor).toBe(0)
  })

  it('corregir el texto vuelve a permitir el cobro', () => {
    const cart = useCartStore()
    cart.add(product({ unitPriceMinor: 5000 }))
    cart.setCashFromDisplay('100,50')
    expect(cart.canCharge).toBe(false)
    cart.setCashFromDisplay('100.50')
    expect(cart.cashInvalid).toBe(false)
    expect(cart.canCharge).toBe(true)
  })

  it('fijar el efectivo en centavos o vaciar la venta limpia el estado de inválido', () => {
    const cart = useCartStore()
    cart.setCashFromDisplay('1,5')
    expect(cart.cashInvalid).toBe(true)
    cart.setCashMinor(2000)
    expect(cart.cashInvalid).toBe(false)

    cart.setCashFromDisplay('abc')
    expect(cart.cashInvalid).toBe(true)
    cart.clear()
    expect(cart.cashInvalid).toBe(false)
  })

  it('topa el efectivo en el máximo del contrato (entero de 32 bits)', () => {
    const cart = useCartStore()
    cart.setCashFromDisplay('99999999999')
    expect(cart.cashReceivedMinor).toBe(2147483647)
  })

  it('setCashMinor acepta enteros y sanea negativos y decimales', () => {
    const cart = useCartStore()
    cart.setCashMinor(5000)
    expect(cart.cashReceivedMinor).toBe(5000)
    cart.setCashMinor(-1)
    expect(cart.cashReceivedMinor).toBe(0)
    cart.setCashMinor(10.7)
    expect(cart.cashReceivedMinor).toBe(10)
  })
})

describe('cart.store — signature (detecta cambios que exigen un id nuevo)', () => {
  it('es igual para el mismo contenido sin importar el orden de las líneas', () => {
    const one = useCartStore()
    one.add(product({ id: 'a' }))
    one.add(product({ id: 'b' }))
    one.setCashMinor(5000)
    const first = one.signature

    one.clear()
    one.add(product({ id: 'b' }))
    one.add(product({ id: 'a' }))
    one.setCashMinor(5000)

    expect(one.signature).toBe(first)
  })

  it('cambia con la cantidad, con los productos y con el efectivo', () => {
    const cart = useCartStore()
    cart.add(product({ id: 'a' }))
    cart.setCashMinor(5000)
    const base = cart.signature

    cart.increment('a')
    const withQty = cart.signature
    expect(withQty).not.toBe(base)

    cart.add(product({ id: 'b' }))
    const withOther = cart.signature
    expect(withOther).not.toBe(withQty)

    cart.setCashMinor(6000)
    expect(cart.signature).not.toBe(withOther)
  })
})
