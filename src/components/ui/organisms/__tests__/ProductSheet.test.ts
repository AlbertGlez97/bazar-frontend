// Ficha de producto: lo que se ve al escanear su QR.
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductSheet from '../ProductSheet.vue'
import source from '../ProductSheet.vue?raw'
import { makeProduct } from '@/test/factories'

const product = makeProduct({
  name: 'Playera lisa', brand: 'Casa Vieja', presentation: 'Azul · 28', description: 'Algodón peinado',
  unitPriceMinor: 15050, purchaseCostMinor: 9000, stock: 7, image: '/uploads/products/abc.png',
})
const mountSheet = (props: Record<string, unknown> = {}) =>
  mount(ProductSheet, { props: { modelValue: true, product, isSocio: false, ...props }, global: { stubs: { teleport: true } } })
const button = (w: ReturnType<typeof mountSheet>, text: string) => w.findAll('button').find((b) => b.text() === text)

describe('ProductSheet — contenido', () => {
  it('foto grande, nombre, marca, presentación, descripción, precio y existencia', () => {
    const w = mountSheet()
    expect(w.get('img.product-sheet__img').attributes('src')).toBe('/uploads/products/abc.png')
    expect(w.get('img.product-sheet__img').attributes('alt')).toBe('Playera lisa')
    expect(w.text()).toContain('Playera lisa')
    expect(w.get('.product-sheet__brand').text()).toBe('Casa Vieja')
    expect(w.get('.product-sheet__presentation').text()).toBe('Azul · 28')
    expect(w.get('.product-sheet__description').text()).toBe('Algodón peinado')
    expect(w.get('.product-sheet__price').text()).toBe('$150.50')
    expect(w.get('.product-sheet__stock').text()).toContain('7')
  })

  it('la foto se contiene entera (contain), no se recorta', () => {
    expect(source).toMatch(/\.product-sheet__img\s*\{[^}]*object-fit:\s*contain/)
  })

  it('sin foto: un marcador, no una imagen rota', () => {
    const w = mountSheet({ product: { ...product, image: null } })
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('.product-sheet__placeholder').exists()).toBe(true)
  })

  it('lo que no tiene no se dibuja', () => {
    const w = mountSheet({ product: makeProduct({ name: 'Taza' }) })
    expect(w.find('.product-sheet__brand').exists()).toBe(false)
    expect(w.find('.product-sheet__presentation').exists()).toBe(false)
    expect(w.find('.product-sheet__description').exists()).toBe(false)
  })

  it('agotado se dice con palabras', () => {
    expect(mountSheet({ product: { ...product, stock: 0 } }).get('.product-sheet__stock').text()).toContain('Agotado')
  })
})

describe('ProductSheet — costo y acciones por rol', () => {
  it('un colaborador NO ve costo ni Editar ni Reponer', () => {
    const w = mountSheet({ isSocio: false })
    expect(w.text()).not.toContain('Costo')
    expect(w.text()).not.toContain('$90.00')
    expect(button(w, 'Editar')).toBeUndefined()
    expect(button(w, 'Reponer')).toBeUndefined()
  })

  it('un socio ve el costo y Editar y Reponer', () => {
    const w = mountSheet({ isSocio: true })
    expect(w.get('.product-sheet__cost').text()).toContain('$90.00')
    expect(button(w, 'Editar')).toBeDefined()
    expect(button(w, 'Reponer')).toBeDefined()
  })

  it('un socio sin costo registrado no ve un $0.00 inventado', () => {
    const w = mountSheet({ isSocio: true, product: { ...product, purchaseCostMinor: null } })
    expect(w.get('.product-sheet__cost').text()).toContain('Sin costo')
  })

  it('Reponer solo en productos por cantidad y activos', () => {
    expect(button(mountSheet({ isSocio: true, product: { ...product, tipo: 'unica' } }), 'Reponer')).toBeUndefined()
    expect(button(mountSheet({ isSocio: true, product: { ...product, active: false } }), 'Reponer')).toBeUndefined()
  })

  it('Editar y Reponer emiten con el producto', async () => {
    const w = mountSheet({ isSocio: true })
    await button(w, 'Editar')!.trigger('click')
    await button(w, 'Reponer')!.trigger('click')
    expect(w.emitted('edit')).toEqual([[product]])
    expect(w.emitted('restock')).toEqual([[product]])
  })
})

describe('ProductSheet — acciones de venta (sobre el escáner)', () => {
  it('sin showSaleActions no hay Agregar ni Escanear otro', () => {
    const w = mountSheet()
    expect(button(w, 'Agregar a la venta')).toBeUndefined()
    expect(button(w, 'Escanear otro')).toBeUndefined()
  })

  it('con showSaleActions: Agregar a la venta y Escanear otro emiten', async () => {
    const w = mountSheet({ showSaleActions: true })
    await button(w, 'Agregar a la venta')!.trigger('click')
    await button(w, 'Escanear otro')!.trigger('click')
    expect(w.emitted('add')).toEqual([[product]])
    expect(w.emitted('scan-another')).toHaveLength(1)
  })

  it('Agregar se deshabilita si está agotado', () => {
    const w = mountSheet({ showSaleActions: true, product: { ...product, stock: 0 } })
    expect(button(w, 'Agregar a la venta')!.attributes('disabled')).toBeDefined()
  })

  it('cerrar emite update:modelValue false', async () => {
    const w = mountSheet()
    await w.get('[aria-label="Cerrar"]').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual([false])
  })
})
