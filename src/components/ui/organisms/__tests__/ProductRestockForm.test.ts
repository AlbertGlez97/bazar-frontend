import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductRestockForm from '../ProductRestockForm.vue'
import { MAX_STOCK } from '@/utils/product-restock'
import type { Product } from '@/types/product.types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p-1', name: 'Lámpara', tipo: 'cantidad', unitPriceMinor: 5000, initialStock: 10, stock: 10,
  category: null, purchaseCostMinor: 1000, supplier: null, notes: null,
  createdAt: '2026-01-01T00:00:00.000Z', active: true, image: null, ...overrides,
})

type Wrapper = ReturnType<typeof mountForm>
function mountForm(props: { product?: Product, loading?: boolean } = {}) {
  return mount(ProductRestockForm, { props: { product: product(), ...props } })
}

const stepperField = (w: Wrapper) => w.get('input.quantity-stepper__value')
const plus = (w: Wrapper) => w.get('button[data-action="increment"]')
const minus = (w: Wrapper) => w.get('button[data-action="decrement"]')
const costInput = (w: Wrapper) => w.get('input[inputmode="decimal"]')
const noteField = (w: Wrapper) => w.get('textarea')
const submit = (w: Wrapper) => w.get('button[type="submit"]')
const lastSubmit = (w: Wrapper) => w.emitted('submit')?.at(-1)?.[0]

describe('ProductRestockForm', () => {
  describe('contenido', () => {
    it('nombra el producto y dice cuánto hay ahora', () => {
      const wrapper = mountForm()

      expect(wrapper.text()).toContain('Lámpara')
      expect(wrapper.text()).toContain('Existencia actual: 10')
    })

    it('arranca en 1 pieza y muestra cómo quedaría la existencia', () => {
      const wrapper = mountForm()

      expect((stepperField(wrapper).element as HTMLInputElement).value).toBe('1')
      expect(wrapper.text()).toContain('Después de reponer: 11')
    })

    it('usa el selector de cantidad (se puede teclear) con el nombre del producto', () => {
      const wrapper = mountForm()

      expect(wrapper.get('[role="group"]').attributes('aria-label')).toBe('Cantidad de Lámpara')
      expect(stepperField(wrapper).attributes('aria-label')).toBe('Cantidad de Lámpara')
    })

    it('explica qué pasa con el costo y marca el costo como opcional', () => {
      const wrapper = mountForm()

      expect(wrapper.text()).toContain('Costo por pieza de esta compra (MXN, opcional)')
      expect(wrapper.text()).toContain('el costo del producto se promedia')
      expect(wrapper.text()).toContain('Nota (opcional)')
    })

    it('tiene los botones Reponer y Cancelar', () => {
      const wrapper = mountForm()

      expect(submit(wrapper).text()).toBe('Reponer')
      expect(wrapper.findAll('button').some((b) => b.text() === 'Cancelar')).toBe(true)
    })
  })

  describe('cantidad', () => {
    it('+ y − cambian la cantidad y la existencia resultante', async () => {
      const wrapper = mountForm()

      await plus(wrapper).trigger('click')
      await plus(wrapper).trigger('click')
      expect(wrapper.text()).toContain('Después de reponer: 13')
      await minus(wrapper).trigger('click')
      expect(wrapper.text()).toContain('Después de reponer: 12')
    })

    it('no baja de 1', async () => {
      const wrapper = mountForm()

      await minus(wrapper).trigger('click')

      expect((stepperField(wrapper).element as HTMLInputElement).value).toBe('1')
    })

    it('se puede teclear una cantidad grande', async () => {
      const wrapper = mountForm()

      await stepperField(wrapper).setValue('100')

      expect(wrapper.text()).toContain('Después de reponer: 110')
    })

    it('no deja subir más allá de lo que cabe en la existencia máxima', async () => {
      const wrapper = mountForm({ product: product({ stock: MAX_STOCK - 1 }) })

      await plus(wrapper).trigger('click')

      expect((stepperField(wrapper).element as HTMLInputElement).value).toBe('1')
      expect(stepperField(wrapper).attributes('max')).toBe('1')
    })
  })

  describe('enviar', () => {
    it('solo con la cantidad: manda solo la cantidad', async () => {
      const wrapper = mountForm()
      await plus(wrapper).trigger('click')

      await wrapper.get('form').trigger('submit')

      expect(lastSubmit(wrapper)).toEqual({ quantity: 2 })
    })

    it('con costo y nota: el costo viaja en centavos y la nota recortada', async () => {
      const wrapper = mountForm()
      await stepperField(wrapper).setValue('5')
      await costInput(wrapper).setValue('12.50')
      await noteField(wrapper).setValue('  Compra del sábado ')

      await wrapper.get('form').trigger('submit')

      expect(lastSubmit(wrapper)).toEqual({ quantity: 5, unitCostMinor: 1250, note: 'Compra del sábado' })
    })

    it('un costo de 0 se manda como 0 (no se confunde con vacío)', async () => {
      const wrapper = mountForm()
      await costInput(wrapper).setValue('0')

      await wrapper.get('form').trigger('submit')

      expect(lastSubmit(wrapper)).toEqual({ quantity: 1, unitCostMinor: 0 })
    })
  })

  describe('validación (no manda nada y marca el campo)', () => {
    it('cantidad 0', async () => {
      const wrapper = mountForm()
      await stepperField(wrapper).setValue('0')

      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.text()).toContain('Escribe cuántas piezas compraste (1 o más).')
      expect(wrapper.text()).toContain('Revisa los campos marcados para continuar.')
    })

    it('un costo que no se entiende', async () => {
      const wrapper = mountForm()
      await costInput(wrapper).setValue('100,50')

      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.text()).toContain('No entiendo ese monto')
      expect(costInput(wrapper).attributes('aria-invalid')).toBe('true')
    })

    it('una nota demasiado larga', async () => {
      const wrapper = mountForm()
      await noteField(wrapper).setValue('x'.repeat(1001))

      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('submit')).toBeUndefined()
      expect(wrapper.text()).toContain('hasta 1000 caracteres')
    })

    it('corregir y reenviar limpia los errores', async () => {
      const wrapper = mountForm()
      await costInput(wrapper).setValue('abc')
      await wrapper.get('form').trigger('submit')
      expect(wrapper.text()).toContain('No entiendo ese monto')

      await costInput(wrapper).setValue('8')
      await wrapper.get('form').trigger('submit')

      expect(wrapper.text()).not.toContain('No entiendo ese monto')
      expect(lastSubmit(wrapper)).toEqual({ quantity: 1, unitCostMinor: 800 })
    })
  })

  describe('mientras se envía (sin doble clic)', () => {
    it('el botón Reponer se deshabilita', () => {
      const wrapper = mountForm({ loading: true })

      expect(submit(wrapper).attributes('disabled')).toBeDefined()
    })

    it('Cancelar y los campos también se bloquean', () => {
      const wrapper = mountForm({ loading: true })

      const cancel = wrapper.findAll('button').find((b) => b.text() === 'Cancelar')!
      expect(cancel.attributes('disabled')).toBeDefined()
      expect(stepperField(wrapper).attributes('disabled')).toBeDefined()
      expect(costInput(wrapper).attributes('disabled')).toBeDefined()
      expect(noteField(wrapper).attributes('disabled')).toBeDefined()
    })

    it('un segundo envío (Enter) mientras tanto no emite nada', async () => {
      const wrapper = mountForm({ loading: true })

      await wrapper.get('form').trigger('submit')

      expect(wrapper.emitted('submit')).toBeUndefined()
    })
  })

  it('Cancelar avisa con cancel', async () => {
    const wrapper = mountForm()

    await wrapper.findAll('button').find((b) => b.text() === 'Cancelar')!.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
