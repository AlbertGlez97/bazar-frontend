// "Crear otro igual": qué se copia de un producto y qué se deja vacío.
import { describe, expect, it } from 'vitest'
import { duplicateDraft } from '../product-duplicate'
import { makeProduct } from '@/test/factories'

const source = makeProduct({
  id: '0190a5f0-7c3e-7000-8000-00000000000a',
  name: 'Playera lisa',
  tipo: 'cantidad',
  brand: 'Casa Vieja',
  presentation: 'Azul · 28',
  description: 'Algodón peinado',
  category: 'Ropa',
  unitPriceMinor: 15000,
  purchaseCostMinor: 9000,
  supplier: 'Textiles SA',
  notes: 'Pedir en caja',
  stock: 7,
  initialStock: 12,
  image: '/uploads/products/abc.png',
})

describe('duplicateDraft', () => {
  it('copia nombre, tipo, marca, categoría, precio, costo, proveedor, notas y descripción', () => {
    expect(duplicateDraft(source)).toMatchObject({
      name: 'Playera lisa',
      tipo: 'cantidad',
      brand: 'Casa Vieja',
      category: 'Ropa',
      unitPriceMinor: 15000,
      purchaseCostMinor: 9000,
      supplier: 'Textiles SA',
      notes: 'Pedir en caja',
      description: 'Algodón peinado',
    })
  })

  it('NO copia la presentación ni la existencia (cada combinación tiene la suya)', () => {
    const draft = duplicateDraft(source)

    expect(draft).not.toHaveProperty('presentation')
    expect(draft).not.toHaveProperty('stock')
    expect(draft).not.toHaveProperty('initialStock')
  })

  it('NO arrastra identidad: ni id del nuevo, ni fechas, ni si estaba activo', () => {
    const draft = duplicateDraft(source)

    expect(draft).not.toHaveProperty('id')
    expect(draft).not.toHaveProperty('createdAt')
    expect(draft).not.toHaveProperty('active')
  })

  it('recuerda de dónde viene y qué foto copiar', () => {
    expect(duplicateDraft(source)).toMatchObject({ sourceId: source.id, imageUrl: '/uploads/products/abc.png' })
  })

  it('un producto sin foto, sin marca ni descripción: todo nulo', () => {
    const bare = makeProduct({ name: 'Taza', purchaseCostMinor: 100 })
    const draft = duplicateDraft(bare)

    expect(draft).toMatchObject({ brand: null, description: null, imageUrl: null, category: null })
  })

  it('un producto de antes de existir los campos (propiedades ausentes) no rompe', () => {
    const legacy = makeProduct({ name: 'Viejo' })
    delete (legacy as Partial<typeof legacy>).brand
    delete (legacy as Partial<typeof legacy>).description
    delete (legacy as Partial<typeof legacy>).purchaseCostMinor

    expect(duplicateDraft(legacy)).toMatchObject({ brand: null, description: null, purchaseCostMinor: null })
  })

  it('es una copia: cambiar el borrador no toca el producto', () => {
    const draft = duplicateDraft(source)
    draft.name = 'Otro'

    expect(source.name).toBe('Playera lisa')
  })
})
