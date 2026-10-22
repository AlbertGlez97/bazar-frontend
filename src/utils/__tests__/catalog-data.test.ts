import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CATALOG_DATA_OPTIONS,
  OTHERS_CATEGORY,
  STANDARD_PRESENTATION,
  buildCatalogData,
  categoryKey,
  listCatalogCategories,
  stockLabel,
  toCatalogSource,
} from '../catalog-data'
import { formatMinorMoney } from '../money'
import { normalizeKey, normalizeText } from '../text-normalize'
import type { CatalogDataOptions, CatalogSource } from '@/types/catalog.types'
import { makeProduct } from '@/test/factories'

let counter = 0
const src = (overrides: Partial<CatalogSource> = {}): CatalogSource => {
  counter += 1
  return {
    id: `p-${counter}`, name: 'Playera', brand: null, presentation: null, description: null,
    unitPriceMinor: 15000, stock: 5, tipo: 'cantidad', category: null, image: null, ...overrides,
  }
}
const build = (sources: CatalogSource[], options: Partial<CatalogDataOptions> = {}) =>
  buildCatalogData(sources, { ...DEFAULT_CATALOG_DATA_OPTIONS, ...options })

describe('normalización de texto', () => {
  it('quita acentos, mayúsculas y espacios de más', () => {
    expect(normalizeText('  CAFÉ ')).toBe('cafe')
    expect(normalizeKey('  Ropa   DE\tCama ')).toBe('ropa de cama')
    expect(normalizeKey('Ñandú')).toBe('nandu')
  })

  it('"Otros" y una categoría vacía comparten llave', () => {
    expect(categoryKey(null)).toBe('')
    expect(categoryKey('   ')).toBe('')
    expect(categoryKey(' OTROS ')).toBe('')
    expect(categoryKey('Ropa')).toBe('ropa')
  })
})

describe('agrupación de variantes (nombre + marca + categoría)', () => {
  it('junta mayúsculas, acentos y espacios distintos en un solo producto', () => {
    const data = build([
      src({ name: 'Camisa Básica', brand: 'Nike', category: 'Ropa', presentation: 'S' }),
      src({ name: '  camisa   básica ', brand: 'NIKE', category: 'ropa', presentation: 'M' }),
      src({ name: 'CAMISA BASICA', brand: 'nike', category: 'Ropa ', presentation: 'L' }),
    ])
    expect(data.productCount).toBe(1)
    expect(data.recordCount).toBe(3)
    expect(data.mergedCount).toBe(2)
    expect(data.categories[0]!.entries[0]!.variants.map((v) => v.presentation)).toEqual(['L', 'M', 'S'])
  })

  it('el nombre y la marca mostrados son la escritura más frecuente del grupo', () => {
    const data = build([
      src({ name: 'Camisa Básica', brand: 'Nike' }),
      src({ name: 'camisa basica', brand: 'NIKE' }),
      src({ name: 'Camisa Básica', brand: 'Nike' }),
    ])
    const entry = data.categories[0]!.entries[0]!
    expect(entry.name).toBe('Camisa Básica')
    expect(entry.brand).toBe('Nike')
  })

  it('un empate de escrituras se resuelve igual sin importar el orden de entrada', () => {
    const a = src({ name: 'Taza' })
    const b = src({ name: 'taza' })
    expect(build([a, b]).categories[0]!.entries[0]!.name).toBe(build([b, a]).categories[0]!.entries[0]!.name)
  })

  it('LIMITACIÓN: marca vacía en un registro y llena en otro NO se agrupan', () => {
    const data = build([src({ name: 'Taza', brand: null }), src({ name: 'Taza', brand: 'Sol' })])
    expect(data.productCount).toBe(2)
  })

  it('LIMITACIÓN: nombres que incluyen la variante ("Playera azul"/"Playera roja") NO se agrupan', () => {
    const data = build([src({ name: 'Playera azul' }), src({ name: 'Playera roja' })])
    expect(data.productCount).toBe(2)
  })

  it('no junta la misma combinación de nombre y marca en categorías distintas', () => {
    const data = build([src({ name: 'Taza', category: 'Hogar' }), src({ name: 'Taza', category: 'Regalos' })])
    expect(data.productCount).toBe(2)
    expect(data.categories.map((c) => c.name)).toEqual(['Hogar', 'Regalos'])
  })

  it('con "Agrupar variantes" apagado cada registro es un producto', () => {
    const data = build([src({ name: 'Taza' }), src({ name: 'Taza' })], { groupVariants: false })
    expect(data.productCount).toBe(2)
    expect(data.mergedCount).toBe(0)
  })

  it('una variante sin presentación se muestra como "Estándar" y va primero', () => {
    const data = build([src({ name: 'Taza', presentation: '350 ml' }), src({ name: 'Taza', presentation: '  ' })])
    expect(data.categories[0]!.entries[0]!.variants.map((v) => v.presentation)).toEqual([STANDARD_PRESENTATION, '350 ml'])
  })

  it('ordena las presentaciones de forma natural ("2" antes que "10")', () => {
    const data = build(['10', '2', '1'].map((presentation) => src({ name: 'Zapato', presentation })))
    expect(data.categories[0]!.entries[0]!.variants.map((v) => v.presentation)).toEqual(['1', '2', '10'])
  })

  it('cada variante lleva su precio y su existencia', () => {
    const data = build([
      src({ name: 'Taza', presentation: 'Chica', unitPriceMinor: 9950, stock: 4 }),
      src({ name: 'Taza', presentation: 'Grande', unitPriceMinor: 15000, stock: 0 }),
    ])
    const [chica, grande] = data.categories[0]!.entries[0]!.variants
    expect(formatMinorMoney(chica!.unitPriceMinor)).toBe('$99.50')
    expect(chica!.stockLabel).toBe('4')
    expect(formatMinorMoney(grande!.unitPriceMinor)).toBe('$150.00')
    expect(grande!.stockLabel).toBe('Agotado')
  })

  it('la foto del grupo es la de la primera variante (en orden mostrado) que tenga', () => {
    const data = build([
      src({ name: 'Taza', presentation: 'A', image: null }),
      src({ name: 'Taza', presentation: 'C', image: '/uploads/products/c.png' }),
      src({ name: 'Taza', presentation: 'B', image: '/uploads/products/b.png' }),
    ])
    expect(data.categories[0]!.entries[0]!.image).toBe('/uploads/products/b.png')
    expect(data.photoCount).toBe(1)
  })

  it('un grupo sin ninguna foto tiene image null y no cuenta en las fotos', () => {
    const data = build([src({ name: 'Taza' })])
    expect(data.categories[0]!.entries[0]!.image).toBeNull()
    expect(data.photoCount).toBe(0)
  })

  it('la descripción del grupo es la primera que exista', () => {
    const data = build([
      src({ name: 'Taza', presentation: 'A', description: null }),
      src({ name: 'Taza', presentation: 'B', description: ' De  barro ' }),
    ])
    expect(data.categories[0]!.entries[0]!.description).toBe('De barro')
  })
})

describe('categorías', () => {
  it('sin categoría (null, vacía o solo espacios) va a "Otros", siempre al final', () => {
    const data = build([
      src({ name: 'A', category: null }),
      src({ name: 'B', category: '' }),
      src({ name: 'C', category: '   ' }),
      src({ name: 'D', category: 'Zapatos' }),
      src({ name: 'E', category: 'Árboles' }),
    ])
    expect(data.categories.map((c) => c.name)).toEqual(['Árboles', 'Zapatos', OTHERS_CATEGORY])
    expect(data.categories.at(-1)!.isOthers).toBe(true)
    expect(data.categories.at(-1)!.entries.map((e) => e.name)).toEqual(['A', 'B', 'C'])
  })

  it('una categoría escrita "otros" se junta con las que no tienen', () => {
    const data = build([src({ name: 'A', category: 'otros' }), src({ name: 'B', category: null })])
    expect(data.categories).toHaveLength(1)
    expect(data.categories[0]!.name).toBe(OTHERS_CATEGORY)
  })

  it('"Otros" queda al final aunque alfabéticamente iría antes', () => {
    const data = build([src({ category: null }), src({ name: 'X', category: 'Telas' })])
    expect(data.categories.map((c) => c.name)).toEqual(['Telas', OTHERS_CATEGORY])
  })

  it('las ordena alfabéticamente con es-MX (la Ñ después de la N, los acentos no cambian el orden)', () => {
    const data = build(['Ñoños', 'Zapatos', 'Ángeles', 'Nubes', 'Bazar', 'Ofertas'].map((category) => src({ name: category, category })))
    expect(data.categories.map((c) => c.name)).toEqual(['Ángeles', 'Bazar', 'Nubes', 'Ñoños', 'Ofertas', 'Zapatos'])
  })

  it('agrupa categorías que solo cambian en mayúsculas, acentos o espacios y muestra la más frecuente', () => {
    const data = build([
      src({ name: 'A', category: 'Ropa' }),
      src({ name: 'B', category: 'ropa' }),
      src({ name: 'C', category: ' Ropa  ' }),
      src({ name: 'D', category: 'RÓPA' }),
    ])
    expect(data.categories).toHaveLength(1)
    expect(data.categories[0]!.name).toBe('Ropa')
    expect(data.categories[0]!.entries).toHaveLength(4)
  })

  it('dentro de cada categoría ordena los productos por nombre', () => {
    const data = build(['Taza', 'Árbol', 'Plato', 'Vaso'].map((name) => src({ name, category: 'Hogar' })))
    expect(data.categories[0]!.entries.map((e) => e.name)).toEqual(['Árbol', 'Plato', 'Taza', 'Vaso'])
  })

  it('lista las categorías elegibles para el filtro, con "Otros" al final', () => {
    expect(listCatalogCategories([src({ category: null }), src({ category: 'Telas' }), src({ category: 'Bazar' })])).toEqual(['Bazar', 'Telas', OTHERS_CATEGORY])
  })
})

describe('existencia', () => {
  it('exacta: cantidad muestra el número, única "Pieza única" y 0 "Agotado"', () => {
    expect(stockLabel({ stock: 7, tipo: 'cantidad' }, 'exact')).toBe('7')
    expect(stockLabel({ stock: 1, tipo: 'cantidad' }, 'exact')).toBe('1')
    expect(stockLabel({ stock: 1, tipo: 'unica' }, 'exact')).toBe('Pieza única')
    expect(stockLabel({ stock: 0, tipo: 'cantidad' }, 'exact')).toBe('Agotado')
    expect(stockLabel({ stock: 0, tipo: 'unica' }, 'exact')).toBe('Agotado')
  })

  it('disponibilidad: Disponible / Últimas piezas (<= umbral, por defecto 3) / Agotado', () => {
    expect(stockLabel({ stock: 0, tipo: 'cantidad' }, 'availability')).toBe('Agotado')
    expect(stockLabel({ stock: 1, tipo: 'cantidad' }, 'availability')).toBe('Últimas piezas')
    expect(stockLabel({ stock: 3, tipo: 'cantidad' }, 'availability')).toBe('Últimas piezas')
    expect(stockLabel({ stock: 4, tipo: 'cantidad' }, 'availability')).toBe('Disponible')
  })

  it('disponibilidad con un umbral configurable', () => {
    expect(stockLabel({ stock: 5, tipo: 'cantidad' }, 'availability', 5)).toBe('Últimas piezas')
    expect(stockLabel({ stock: 6, tipo: 'cantidad' }, 'availability', 5)).toBe('Disponible')
    expect(stockLabel({ stock: 1, tipo: 'cantidad' }, 'availability', 0)).toBe('Disponible')
  })

  it('ocultar: no hay texto de existencia', () => {
    expect(stockLabel({ stock: 5, tipo: 'cantidad' }, 'hidden')).toBe('')
    expect(stockLabel({ stock: 0, tipo: 'cantidad' }, 'hidden')).toBe('')
  })

  it('el modo y el umbral llegan a cada variante del catálogo', () => {
    const sources = [src({ name: 'Taza', presentation: 'A', stock: 2 }), src({ name: 'Taza', presentation: 'B', stock: 9 })]
    const labels = (options: Partial<CatalogDataOptions>) => build(sources, options).categories[0]!.entries[0]!.variants.map((v) => v.stockLabel)
    expect(labels({ stockMode: 'exact' })).toEqual(['2', '9'])
    expect(labels({ stockMode: 'availability' })).toEqual(['Últimas piezas', 'Disponible'])
    expect(labels({ stockMode: 'availability', lowStockThreshold: 10 })).toEqual(['Últimas piezas', 'Últimas piezas'])
    expect(labels({ stockMode: 'hidden' })).toEqual(['', ''])
  })
})

describe('filtro de qué productos entran', () => {
  const sources = [
    src({ id: 'a', name: 'A', category: 'Ropa', stock: 3 }),
    src({ id: 'b', name: 'B', category: 'Hogar', stock: 0 }),
    src({ id: 'c', name: 'C', category: null, stock: 1 }),
    src({ id: 'd', name: 'D', category: 'ropa', stock: 0 }),
  ]
  const names = (options: Partial<CatalogDataOptions>) => build(sources, options).categories.flatMap((c) => c.entries.map((e) => e.name)).sort()

  it('todos', () => {
    expect(names({ filter: { mode: 'all' } })).toEqual(['A', 'B', 'C', 'D'])
  })

  it('por categorías (selección múltiple, sin distinguir mayúsculas ni acentos)', () => {
    expect(names({ filter: { mode: 'categories', categories: ['Ropa'] } })).toEqual(['A', 'D'])
    expect(names({ filter: { mode: 'categories', categories: ['RÓPA', 'Hogar'] } })).toEqual(['A', 'B', 'D'])
    expect(names({ filter: { mode: 'categories', categories: [OTHERS_CATEGORY] } })).toEqual(['C'])
    expect(names({ filter: { mode: 'categories', categories: [] } })).toEqual([])
  })

  it('solo con existencia excluye stock 0', () => {
    expect(names({ filter: { mode: 'in-stock' } })).toEqual(['A', 'C'])
  })

  it('selección manual por id', () => {
    expect(names({ filter: { mode: 'manual', ids: ['b', 'c'] } })).toEqual(['B', 'C'])
    expect(names({ filter: { mode: 'manual', ids: [] } })).toEqual([])
  })

  it('el filtro se aplica antes de agrupar: una variante agotada no entra con "solo con existencia"', () => {
    const data = build(
      [src({ name: 'Taza', presentation: 'A', stock: 2 }), src({ name: 'Taza', presentation: 'B', stock: 0 })],
      { filter: { mode: 'in-stock' } },
    )
    expect(data.categories[0]!.entries[0]!.variants.map((v) => v.presentation)).toEqual(['A'])
    expect(data.recordCount).toBe(1)
  })

  it('un filtro que no deja nada da un catálogo vacío', () => {
    const data = build(sources, { filter: { mode: 'manual', ids: ['zzz'] } })
    expect(data).toMatchObject({ categories: [], productCount: 0, recordCount: 0, mergedCount: 0, photoCount: 0 })
  })
})

describe('lista blanca: el costo nunca llega al generador', () => {
  const full = makeProduct({
    id: 'p-secret', name: 'Taza', category: 'Hogar', brand: 'Sol', presentation: '350 ml', description: 'De barro',
    unitPriceMinor: 15000, purchaseCostMinor: 987654, supplier: 'Proveedor Secreto SA', notes: 'nota interna confidencial',
    image: '/uploads/products/x.png',
  })

  it('toCatalogSource copia solo los campos permitidos', () => {
    const source = toCatalogSource(full)
    expect(Object.keys(source).sort()).toEqual(
      ['brand', 'category', 'description', 'id', 'image', 'name', 'presentation', 'stock', 'tipo', 'unitPriceMinor'],
    )
    expect(source).not.toHaveProperty('purchaseCostMinor')
    expect(source).not.toHaveProperty('supplier')
    expect(source).not.toHaveProperty('notes')
  })

  it('en la salida no aparece ni el nombre ni el valor del costo, el proveedor o las notas', () => {
    const output = JSON.stringify(build([toCatalogSource(full)]))
    for (const forbidden of ['purchaseCost', 'supplier', 'notes', '987654', 'Proveedor Secreto', 'nota interna']) {
      expect(output).not.toContain(forbidden)
    }
    expect(output).toContain('Taza')
  })

  it('aunque alguien le pase el producto COMPLETO por error, la salida no lo arrastra', () => {
    const output = JSON.stringify(build([full as unknown as CatalogSource]))
    for (const forbidden of ['purchaseCost', 'supplier', 'notes', '987654', 'Proveedor Secreto', 'nota interna']) {
      expect(output).not.toContain(forbidden)
    }
  })
})
