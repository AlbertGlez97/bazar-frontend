import { describe, it, expect } from 'vitest'

// Guarda de contención de imagen y de desborde flex/grid: una imagen de
// producto con dimensiones extremas no debe poder crecer más allá de su
// miniatura, y el contenido del catálogo nunca debe encoger al panel "Tu
// venta". jsdom no calcula layout real, así que se comprueba el CONTRATO DE
// CSS (mismo patrón que touch-targets.test.ts): la miniatura fija su tamaño
// con `object-fit`/`aspect-ratio`/ancho y alto explícitos, y los contenedores
// flex/grid llevan `min-width: 0` / `minmax(0, ...)` donde el contenido podría
// forzar el ancho. La medición visual real queda para la revisión manual.
const sources = import.meta.glob<string>('../../**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function sourceOf(fileName: string): string {
  const entry = Object.entries(sources).find(([path]) => path.endsWith(`/${fileName}`))
  if (!entry) throw new Error(`No se encontró ${fileName}`)
  return entry[1]
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Cuerpo de la primera regla cuyo selector es exactamente `selector`. */
function ruleBody(source: string, selector: string): string {
  const match = new RegExp(`(?:^|\\n)\\s*${escapeRegex(selector)}\\s*\\{([^}]*)\\}`).exec(source)
  if (!match) throw new Error(`No se encontró la regla "${selector}"`)
  return match[1]
}

/** Valor textual de una propiedad dentro del cuerpo de una regla. */
function propOf(body: string, property: string): string | undefined {
  const match = new RegExp(`(?:^|[;\\s])${escapeRegex(property)}\\s*:\\s*([^;]+);`).exec(body)
  return match?.[1].trim()
}

describe('miniatura de producto: contención de imagen (contrato de CSS)', () => {
  it('ProductCard: la media fija aspect-ratio y la imagen usa object-fit cover, en cuadrícula y grande', () => {
    const source = sourceOf('ProductCard.vue')
    expect(propOf(ruleBody(source, '.product-card__media'), 'aspect-ratio')).toBe('1 / 1')
    expect(propOf(ruleBody(source, '.product-card__img'), 'object-fit')).toBe('cover')
    expect(propOf(ruleBody(source, '.product-card--large .product-card__media'), 'aspect-ratio')).toBe('4 / 3')
  })

  it('ProductCard: la tarjeta (ítem de grilla en Gestión) admite encogerse por debajo de su contenido', () => {
    // Sin esto, un nombre largo sin espacios (o cualquier contenido interno sin
    // restringir) podría forzar la columna de la grilla más allá de lo previsto.
    expect(propOf(ruleBody(sourceOf('ProductCard.vue'), '.product-card'), 'min-width')).toBe('0')
  })

  it('ProductCard: tamaño "list" (Vista de Lista) fija el ancho y alto de la miniatura, no crece con la imagen', () => {
    const body = ruleBody(sourceOf('ProductCard.vue'), '.product-card--list .product-card__media')
    const width = propOf(body, 'width')
    const height = propOf(body, 'height')
    expect(width).toBeDefined()
    expect(height).toBeDefined()
    expect(width).not.toBe('100%')
    expect(height).not.toBe('100%')
  })

  it('ProductCard: tamaño "list" trunca el nombre con elipsis en vez de dejarlo crecer', () => {
    const body = ruleBody(sourceOf('ProductCard.vue'), '.product-card--list .product-card__name')
    expect(propOf(body, 'white-space')).toBe('nowrap')
    expect(propOf(body, 'overflow')).toBe('hidden')
    expect(propOf(body, 'text-overflow')).toBe('ellipsis')
  })

  it('CartLineItem: la miniatura del carrito es de tamaño fijo, recortada, con object-fit cover', () => {
    const source = sourceOf('CartLineItem.vue')
    const media = ruleBody(source, '.cart-line__media')
    expect(propOf(media, 'width')).toBe('4rem')
    expect(propOf(media, 'height')).toBe('4rem')
    expect(propOf(media, 'overflow')).toBe('hidden')
    expect(propOf(ruleBody(source, '.cart-line__img'), 'object-fit')).toBe('cover')
  })

  it('SaleCatalogPicker: la fila de la Vista de Lista trae miniatura fija recortada y nombre truncado', () => {
    const source = sourceOf('SaleCatalogPicker.vue')
    const thumb = ruleBody(source, '.sale-picker__thumb')
    expect(propOf(thumb, 'width')).toBe('3rem')
    expect(propOf(thumb, 'height')).toBe('3rem')
    expect(propOf(thumb, 'overflow')).toBe('hidden')
    expect(propOf(ruleBody(source, '.sale-picker__thumb-img'), 'object-fit')).toBe('cover')

    const name = ruleBody(source, '.sale-picker__row-name')
    expect(propOf(name, 'white-space')).toBe('nowrap')
    expect(propOf(name, 'overflow')).toBe('hidden')
    expect(propOf(name, 'text-overflow')).toBe('ellipsis')
  })
})

describe('"Tu venta" y catálogos: blindaje flex/grid contra desborde (contrato de CSS)', () => {
  it('SaleView: el layout de dos columnas reserva "Tu venta" con su propio rango y nunca deja que el catálogo la encoja', () => {
    const columns = propOf(ruleBody(sourceOf('SaleView.vue'), '.sale-view__layout'), 'grid-template-columns')
    expect(columns).toMatch(/minmax\(0,\s*1fr\)/)
    expect(columns).toMatch(/minmax\(21rem,\s*26rem\)/)
  })

  it('SaleCatalogPicker: cada fila de la Vista de Lista reserva su columna central con minmax(0, 1fr)', () => {
    const columns = propOf(ruleBody(sourceOf('SaleCatalogPicker.vue'), '.sale-picker__item--row'), 'grid-template-columns')
    expect(columns).toMatch(/minmax\(0,\s*1fr\)/)
  })

  it('SaleCatalogPicker: cada celda de la cuadrícula admite encogerse por debajo de su contenido', () => {
    expect(propOf(ruleBody(sourceOf('SaleCatalogPicker.vue'), '.sale-picker__cell'), 'min-width')).toBe('0')
  })
})
