import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCartStore } from '../cart.store'
import type { CartProductInput } from '../cart.store'

const product = (overrides: Partial<CartProductInput> = {}): CartProductInput => ({
  id: 'p-1', name: 'Lámpara', unitPriceMinor: 110000, tipo: 'cantidad', stock: 10, image: null, ...overrides,
})

beforeEach(() => setActivePinia(createPinia()))

describe('cart.store — método de pago', () => {
  it('arranca en EFECTIVO, con el monto vacío', () => {
    const cart = useCartStore()
    cart.add(product())

    expect(cart.paymentMethod).toBe('EFECTIVO')
    expect(cart.amountMinor).toBe(0)
  })

  describe('EFECTIVO: "¿Cuánto te dan?"', () => {
    it('puede superar el total y da el cambio', () => {
      const cart = useCartStore()
      cart.add(product()) // $1,100.00
      cart.setAmountFromDisplay('1,500')

      expect(cart.amountMinor).toBe(150000)
      expect(cart.changeMinor).toBe(40000)
      expect(cart.missingMinor).toBe(0)
      expect(cart.canCharge).toBe(true)
    })

    it('menor al total: dice cuánto falta y no se puede cobrar', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setAmountFromDisplay('1000')

      expect(cart.changeMinor).toBe(0)
      expect(cart.missingMinor).toBe(10000)
      expect(cart.canCharge).toBe(false)
    })

    it('exacto: cambio 0 y se puede cobrar', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setAmountFromDisplay('1100')

      expect(cart.changeMinor).toBe(0)
      expect(cart.canCharge).toBe(true)
    })

    it('vacío: falta todo el total', () => {
      const cart = useCartStore()
      cart.add(product())

      expect(cart.missingMinor).toBe(110000)
      expect(cart.canCharge).toBe(false)
    })
  })

  describe.each(['TRANSFERENCIA', 'TARJETA'] as const)('%s: "Monto cobrado"', (method) => {
    it('viene precargado con el total', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod(method)

      expect(cart.paymentMethod).toBe(method)
      expect(cart.amountMinor).toBe(110000)
      expect(cart.canCharge).toBe(true)
    })

    it('sigue al total mientras la persona no lo edite (agregar un producto lo actualiza)', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod(method)

      cart.add(product())

      expect(cart.totalMinor).toBe(220000)
      expect(cart.amountMinor).toBe(220000)
    })

    it('no hay cambio', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod(method)

      expect(cart.changeMinor).toBe(0)
    })

    it('no puede superar el total: un monto mayor se topa en el total', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod(method)

      cart.setAmountFromDisplay('5,000')

      expect(cart.amountMinor).toBe(110000)
      expect(cart.changeMinor).toBe(0)
      expect(cart.canCharge).toBe(true)
    })

    it('un monto menor al total es un cobro parcial: no se cobra, falta lo demás', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod(method)

      cart.setAmountFromDisplay('300')

      expect(cart.amountMinor).toBe(30000)
      expect(cart.missingMinor).toBe(80000)
      expect(cart.canCharge).toBe(false)
    })

    it('un monto editado deja de seguir al total, pero nunca lo supera', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod(method)
      cart.setAmountFromDisplay('300')

      cart.remove('p-1')
      cart.add(product({ id: 'p-2', unitPriceMinor: 20000 })) // total $200

      expect(cart.totalMinor).toBe(20000)
      expect(cart.amountMinor).toBe(20000)
    })

    it('el campo vacío es $0 de monto (no se vuelve a precargar)', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod(method)

      cart.setAmountFromDisplay('')

      expect(cart.amountMinor).toBe(0)
      expect(cart.missingMinor).toBe(110000)
    })
  })

  describe('cambiar de método', () => {
    it('a transferencia o tarjeta precarga el total aunque ya hubiera efectivo escrito', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setAmountFromDisplay('500')

      cart.setPaymentMethod('TARJETA')

      expect(cart.amountMinor).toBe(110000)
    })

    it('de vuelta a efectivo, el monto queda vacío', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod('TRANSFERENCIA')

      cart.setPaymentMethod('EFECTIVO')

      expect(cart.amountMinor).toBe(0)
      expect(cart.canCharge).toBe(false)
    })

    it('elegir el método que ya está puesto no borra lo escrito', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setAmountFromDisplay('1500')

      cart.setPaymentMethod('EFECTIVO')

      expect(cart.amountMinor).toBe(150000)
    })

    it('un método desconocido se ignora (queda el actual)', () => {
      const cart = useCartStore()
      cart.setPaymentMethod('TARJETA')

      cart.setPaymentMethod('CHEQUE' as never)

      expect(cart.paymentMethod).toBe('TARJETA')
    })

    it('limpia un monto ambiguo anterior', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setAmountFromDisplay('100,50')
      expect(cart.amountInvalid).toBe(true)

      cart.setPaymentMethod('TARJETA')

      expect(cart.amountInvalid).toBe(false)
      expect(cart.canCharge).toBe(true)
    })
  })

  describe('una venta nueva', () => {
    it('vuelve a EFECTIVO y vacía el monto', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod('TARJETA')

      cart.clear()

      expect(cart.paymentMethod).toBe('EFECTIVO')
      expect(cart.amountMinor).toBe(0)
      expect(cart.isEmpty).toBe(true)
    })
  })

  describe('total de $0 (producto regalado)', () => {
    it.each(['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'] as const)('%s: se cobra sin monto', (method) => {
      const cart = useCartStore()
      cart.add(product({ unitPriceMinor: 0 }))
      cart.setPaymentMethod(method)

      expect(cart.canCharge).toBe(true)
    })
  })

  describe('firma (cambia lo que exige un id de venta nuevo)', () => {
    it('cambia con el método aunque el monto cobrado sea el mismo', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setPaymentMethod('TRANSFERENCIA')
      const transfer = cart.signature

      cart.setPaymentMethod('TARJETA')

      expect(cart.signature).not.toBe(transfer)
    })
  })

  describe('fiado/apartado: ¿hay un monto menor al total?', () => {
    it('es "parcial" cuando el monto es menor al total, con cualquier método', () => {
      const cart = useCartStore()
      cart.add(product())

      expect(cart.isPartial).toBe(true) // efectivo vacío = $0
      cart.setAmountFromDisplay('1100')
      expect(cart.isPartial).toBe(false)
      cart.setPaymentMethod('TARJETA')
      expect(cart.isPartial).toBe(false)
      cart.setAmountFromDisplay('200')
      expect(cart.isPartial).toBe(true)
    })

    it('un carrito vacío no es parcial', () => {
      const cart = useCartStore()

      expect(cart.isPartial).toBe(false)
    })

    it('un monto ambiguo no es parcial (el problema es el texto, no que falte dinero)', () => {
      const cart = useCartStore()
      cart.add(product())
      cart.setAmountFromDisplay('100,50')

      expect(cart.isPartial).toBe(false)
    })
  })
})
