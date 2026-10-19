// "Crear otro igual" y "Guardar y crear otro igual" en el formulario de producto.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ProductForm from '../ProductForm.vue'
import { makeProduct } from '@/test/factories'
import { duplicateDraft } from '@/utils/product-duplicate'

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
})

const source = makeProduct({
  name: 'Playera lisa', tipo: 'cantidad', brand: 'Casa Vieja', presentation: 'Azul · 28', description: 'Algodón peinado',
  category: 'Ropa', unitPriceMinor: 15050, purchaseCostMinor: 9000, supplier: 'Textiles SA', notes: 'Pedir en caja',
  stock: 7, initialStock: 12, image: '/uploads/products/abc.png',
})

const mountForm = (props: Record<string, unknown> = {}) => mount(ProductForm, { props, attachTo: document.body })
const field = (wrapper: ReturnType<typeof mountForm>, text: string) => {
  const label = wrapper.findAll('label').find((l) => l.text().startsWith(text))
  if (!label) throw new Error(`No hay etiqueta "${text}"`)
  return wrapper.get(`[id="${label.attributes('for')}"]`)
}
const value = (wrapper: ReturnType<typeof mountForm>, text: string) => (field(wrapper, text).element as HTMLInputElement).value
const buttonWith = (wrapper: ReturnType<typeof mountForm>, text: string) => wrapper.findAll('button').find((b) => b.text() === text)

describe('ProductForm con un borrador (Crear otro igual)', () => {
  it('abre precargado con nombre, tipo, marca, categoría, precio, costo, proveedor, notas y descripción', () => {
    const wrapper = mountForm({ draft: duplicateDraft(source) })

    expect(value(wrapper, 'Nombre')).toBe('Playera lisa')
    expect(value(wrapper, 'Tipo')).toBe('cantidad')
    expect(value(wrapper, 'Marca')).toBe('Casa Vieja')
    expect(value(wrapper, 'Categoría')).toBe('Ropa')
    expect(value(wrapper, 'Precio de venta')).toBe('150.50')
    expect(value(wrapper, 'Costo de compra')).toBe('90.00')
    expect(value(wrapper, 'Proveedor')).toBe('Textiles SA')
    expect(value(wrapper, 'Notas')).toBe('Pedir en caja')
    expect(value(wrapper, 'Descripción breve')).toBe('Algodón peinado')
  })

  it('deja VACÍOS la presentación y la existencia', () => {
    const wrapper = mountForm({ draft: duplicateDraft(source) })

    expect(value(wrapper, 'Presentación')).toBe('')
    expect(value(wrapper, 'Existencia inicial')).toBe('')
  })

  it('una pieza única conserva su existencia fija de 1', () => {
    const wrapper = mountForm({ draft: duplicateDraft(makeProduct({ name: 'Reloj', tipo: 'unica', purchaseCostMinor: 100 })) })

    expect(value(wrapper, 'Existencia inicial')).toBe('1')
  })

  it('enfoca la Presentación', async () => {
    const wrapper = mountForm({ draft: duplicateDraft(source) })
    await flushPromises()

    expect(document.activeElement).toBe(field(wrapper, 'Presentación').element)
  })

  it('sin borrador no mueve el foco (comportamiento de siempre)', async () => {
    const wrapper = mountForm()
    await flushPromises()

    expect(document.activeElement).not.toBe(field(wrapper, 'Presentación').element)
  })

  it('sigue siendo un alta: no se pide existencia hasta escribirla', async () => {
    const wrapper = mountForm({ draft: duplicateDraft(source) })

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Escribe cuántas piezas tienes.')
  })

  it('al guardar manda el alta con la existencia y la presentación nuevas', async () => {
    const wrapper = mountForm({ draft: duplicateDraft(source) })
    await field(wrapper, 'Presentación').setValue('Azul · 30')
    await field(wrapper, 'Existencia inicial').setValue('4')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')!.at(-1)![0]).toMatchObject({
      name: 'Playera lisa', tipo: 'cantidad', brand: 'Casa Vieja', presentation: 'Azul · 30', initialStock: 4,
      unitPriceMinor: 15050, purchaseCostMinor: 9000, supplier: 'Textiles SA', notes: 'Pedir en caja', description: 'Algodón peinado',
    })
  })

  it('la foto: sin elegir otra, el alta pide copiar la de origen (no comparte la ruta)', async () => {
    const wrapper = mountForm({ draft: duplicateDraft(source) })
    await field(wrapper, 'Existencia inicial').setValue('4')

    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('submit')!.at(-1)![0] as Record<string, unknown>
    expect(payload.copyImageFrom).toBe('/uploads/products/abc.png')
    expect(payload.imageFile).toBeNull()
  })

  it('la foto: si se elige otra, esa manda y no se copia la de origen', async () => {
    const wrapper = mountForm({ draft: duplicateDraft(source) })
    await field(wrapper, 'Existencia inicial').setValue('4')
    const file = new File(['x'], 'nueva.png', { type: 'image/png' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')

    await wrapper.find('form').trigger('submit')

    const payload = wrapper.emitted('submit')!.at(-1)![0] as Record<string, unknown>
    expect(payload.imageFile).toBe(file)
    expect(payload.copyImageFrom).toBeUndefined()
  })

  it('un alta normal no trae copyImageFrom', async () => {
    const wrapper = mountForm()
    await field(wrapper, 'Nombre').setValue('Taza')
    const decimals = wrapper.findAll('input').filter((i) => i.attributes('inputmode') === 'decimal')
    await decimals[0].setValue('10')
    await decimals[1].setValue('5')

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('submit')!.at(-1)![0]).not.toHaveProperty('copyImageFrom')
  })
})

describe('ProductForm — botones de "otro igual"', () => {
  it('al crear (nuevo o con borrador) hay un botón secundario "Guardar y crear otro igual"', () => {
    expect(buttonWith(mountForm(), 'Guardar y crear otro igual')).toBeTruthy()
    expect(buttonWith(mountForm({ draft: duplicateDraft(source) }), 'Guardar y crear otro igual')).toBeTruthy()
  })

  it('es secundario: el principal sigue siendo "Crear producto"', () => {
    const wrapper = mountForm()
    const another = buttonWith(wrapper, 'Guardar y crear otro igual')!
    const main = buttonWith(wrapper, 'Crear producto')!

    expect(main.attributes('type')).toBe('submit')
    expect(another.attributes('type')).toBe('button')
    expect(another.classes().join(' ')).toContain('secondary')
  })

  it('"Guardar y crear otro igual" valida igual y emite su propio evento con el mismo contenido', async () => {
    const wrapper = mountForm({ draft: duplicateDraft(source) })
    await field(wrapper, 'Existencia inicial').setValue('3')

    await buttonWith(wrapper, 'Guardar y crear otro igual')!.trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('submit-and-duplicate')!.at(-1)![0]).toMatchObject({ name: 'Playera lisa', initialStock: 3 })
  })

  it('con errores no emite nada', async () => {
    const wrapper = mountForm()

    await buttonWith(wrapper, 'Guardar y crear otro igual')!.trigger('click')

    expect(wrapper.emitted('submit-and-duplicate')).toBeUndefined()
    expect(wrapper.text()).toContain('Ponle un nombre al producto.')
  })

  it('al editar NO está "Guardar y crear otro igual", y sí "Crear otro igual", que emite duplicate', async () => {
    const wrapper = mountForm({ product: source })

    expect(buttonWith(wrapper, 'Guardar y crear otro igual')).toBeUndefined()
    await buttonWith(wrapper, 'Crear otro igual')!.trigger('click')

    expect(wrapper.emitted('duplicate')).toHaveLength(1)
  })

  it('al crear no hay "Crear otro igual" (no hay producto del cual copiar)', () => {
    expect(buttonWith(mountForm(), 'Crear otro igual')).toBeUndefined()
  })

  it('con la petición en curso, los botones se deshabilitan (sin doble envío)', () => {
    const wrapper = mountForm({ loading: true })

    expect(buttonWith(wrapper, 'Guardar y crear otro igual')!.attributes('disabled')).toBeDefined()
  })
})
