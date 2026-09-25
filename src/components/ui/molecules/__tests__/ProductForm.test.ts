import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductForm from '../ProductForm.vue'
import type { Product } from '@/types/product.types'

const product: Product = {
  id: 'p-1',
  name: 'Consola PS5',
  tipo: 'cantidad',
  unitPriceMinor: 500000,
  initialStock: 10,
  stock: 8,
  category: 'Videojuegos',
  purchaseCostMinor: 350000,
  supplier: 'Distribuidor X',
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  active: true,
  image: null,
}

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
})

describe('ProductForm', () => {
  it('modo creación: rechaza envío sin nombre ni precio', async () => {
    const wrapper = mount(ProductForm)
    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Ponle un nombre al producto.')
    expect(wrapper.text()).toContain('Escribe un precio mayor a 0.')
  })

  it('modo creación: tipo "unica" fija existencia inicial en 1 y deshabilitada', () => {
    const wrapper = mount(ProductForm)
    const stockInput = wrapper.findAll('input').find((i) => i.attributes('disabled') !== undefined)
    expect(stockInput?.element.value).toBe('1')
  })

  it('modo creación: envía el payload con conversión correcta de pesos a centavos', async () => {
    const wrapper = mount(ProductForm)
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('Producto nuevo') // input de nombre

    const priceInput = wrapper.findAll('input').find((i) => i.attributes('inputmode') === 'decimal')
    await priceInput?.setValue('125.50')

    await wrapper.find('form').trigger('submit')

    const emitted = wrapper.emitted('submit')
    expect(emitted).toBeTruthy()
    const payload = emitted![0][0] as Record<string, unknown>
    expect(payload.name).toBe('Producto nuevo')
    expect(payload.unitPriceMinor).toBe(12550)
    expect(payload.tipo).toBe('unica')
    expect(payload.imageFile).toBeNull()
  })

  describe('montos con la convención es-MX (coma = miles, punto = decimal)', () => {
    const AMBIGUOUS_MESSAGE = 'No entiendo ese monto'

    async function fill(price: string, cost?: string) {
      const wrapper = mount(ProductForm)
      await wrapper.findAll('input')[0].setValue('Producto nuevo')
      const decimals = wrapper.findAll('input').filter((i) => i.attributes('inputmode') === 'decimal')
      await decimals[0].setValue(price)
      if (cost !== undefined) await decimals[1].setValue(cost)
      await wrapper.find('form').trigger('submit')
      return wrapper
    }

    it.each([
      ['1,000', 100000],
      ['1,000.50', 100050],
      ['$1,000.50', 100050],
      ['19.99', 1999],
    ])('precio %j se envía como %i centavos', async (price, expected) => {
      const wrapper = await fill(price)
      const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
      expect(payload.unitPriceMinor).toBe(expected)
    })

    it.each(['100,50', '1.000,50', '10.005', 'abc'])(
      'precio ambiguo %j no se envía y muestra el error',
      async (price) => {
        const wrapper = await fill(price)
        expect(wrapper.emitted('submit')).toBeUndefined()
        expect(wrapper.text()).toContain(AMBIGUOUS_MESSAGE)
      },
    )

    it('precio "0" sigue pidiendo un precio mayor a 0', async () => {
      const wrapper = await fill('0')
      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.text()).toContain('Escribe un precio mayor a 0.')
    })

    it('costo de compra "1,000" se envía como 100000 centavos', async () => {
      const wrapper = await fill('2,000', '1,000')
      const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
      expect(payload.unitPriceMinor).toBe(200000)
      expect(payload.purchaseCostMinor).toBe(100000)
    })

    it.each(['1,5', 'abc'])(
      'costo de compra ambiguo %j no se envía (antes un texto sin forma de monto se guardaba como 0)',
      async (cost) => {
        const wrapper = await fill('20', cost)
        expect(wrapper.emitted('submit')).toBeUndefined()
        expect(wrapper.text()).toContain(AMBIGUOUS_MESSAGE)
      },
    )

    it('costo de compra vacío sigue siendo válido y no se envía', async () => {
      const wrapper = await fill('20', '')
      const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
      expect(payload.purchaseCostMinor).toBeUndefined()
    })

    it('modo edición: el precio precargado ("1000.00") se lee de vuelta sin cambios', async () => {
      const wrapper = mount(ProductForm, {
        props: { product: { ...product, unitPriceMinor: 100000, purchaseCostMinor: 50000 } },
      })
      const decimals = wrapper.findAll('input').filter((i) => i.attributes('inputmode') === 'decimal')
      expect(decimals[0].element.value).toBe('1000.00')
      expect(decimals[1].element.value).toBe('500.00')

      await wrapper.find('form').trigger('submit')

      const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
      expect(payload).toEqual({ imageFile: null })
    })

    it('modo edición: costo de compra ambiguo no se envía', async () => {
      const wrapper = mount(ProductForm, { props: { product } })
      const decimals = wrapper.findAll('input').filter((i) => i.attributes('inputmode') === 'decimal')
      await decimals[1].setValue('100,50')

      await wrapper.find('form').trigger('submit')

      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.text()).toContain(AMBIGUOUS_MESSAGE)
    })
  })

  it('modo creación: tipo "cantidad" incluye la existencia inicial capturada', async () => {
    const wrapper = mount(ProductForm)
    await wrapper.findAll('input')[0].setValue('Producto nuevo')
    const priceInput = wrapper.findAll('input').find((i) => i.attributes('inputmode') === 'decimal')
    await priceInput?.setValue('10')

    await wrapper.find('select').setValue('cantidad')
    await wrapper.findAll('input').find((i) => i.attributes('type') === 'number')?.setValue(5)

    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload.tipo).toBe('cantidad')
    expect(payload.initialStock).toBe(5)
  })

  it('modo edición: precarga los valores del producto', () => {
    const wrapper = mount(ProductForm, { props: { product } })
    const inputs = wrapper.findAll('input')
    expect(inputs[0].element.value).toBe('Consola PS5')
    expect(wrapper.text()).toContain('Existencia actual: 8')
    expect(wrapper.text()).toContain('Por cantidad')
  })

  it('modo edición: solo envía los campos que cambiaron', async () => {
    const wrapper = mount(ProductForm, { props: { product } })
    const nameInput = wrapper.findAll('input')[0]
    await nameInput.setValue('Consola PS5 (editada)')

    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload).toEqual({ name: 'Consola PS5 (editada)', imageFile: null })
  })

  it('modo edición: no envía campos si nada cambió más que dar click en enviar', async () => {
    const wrapper = mount(ProductForm, { props: { product } })
    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload).toEqual({ imageFile: null })
  })

  it('emite cancel al hacer click en Cancelar', async () => {
    const wrapper = mount(ProductForm)
    await wrapper.find('button[type="button"]').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
