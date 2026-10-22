// @vitest-environment node
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import {
  CONTACT_PLACEHOLDER,
  DEFAULT_CATALOG_DOC_OPTIONS,
  DOCX_MIME,
  catalogFileName,
  fitPhoto,
  generateCatalogDocx,
  longDate,
  type CatalogDocOptions,
} from '../catalog-docx'
import type { ReducedImage } from '../catalog-images'
import { buildCatalogData, toCatalogSource } from '@/utils/catalog-data'
import { makeProduct } from '@/test/factories'
import type { CatalogData } from '@/types/catalog.types'

const DATE = new Date(2026, 9, 21)
const options = (overrides: Partial<CatalogDocOptions> = {}): CatalogDocOptions => ({
  ...DEFAULT_CATALOG_DOC_OPTIONS,
  businessName: 'Bazar Doña Lupe',
  date: DATE,
  ...overrides,
})

/** Bytes de relleno con forma de JPEG (docx no los decodifica: el tamaño viene en `transformation`). */
const jpeg = (width = 400, height = 300): ReducedImage => ({ bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]), width, height, placeholder: false })
const PLACEHOLDER: ReducedImage = { ...jpeg(400, 300), placeholder: true }

const SECRET = { purchaseCostMinor: 987654, supplier: 'Proveedor Secreto SA', notes: 'nota interna confidencial' }

function sampleData(): CatalogData {
  const products = [
    makeProduct({ name: 'Playera Básica', brand: 'Sol', category: 'Ropa', presentation: 'S', unitPriceMinor: 15000, stock: 5, image: '/uploads/products/a.png', ...SECRET }),
    makeProduct({ name: 'playera basica', brand: 'SOL', category: 'ropa', presentation: 'M', unitPriceMinor: 15500, stock: 0, ...SECRET }),
    makeProduct({ name: 'Cuadro Único', category: 'Hogar', tipo: 'unica', stock: 1, unitPriceMinor: 99900, description: 'Óleo sobre tela', ...SECRET }),
    makeProduct({ name: 'Llavero', category: null, stock: 12, unitPriceMinor: 2500, ...SECRET }),
  ]
  return buildCatalogData(products.map(toCatalogSource))
}

async function open(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes)
  const read = (path: string) => zip.file(path)!.async('string')
  return { zip, document: await read('word/document.xml'), styles: await read('word/styles.xml'), read }
}

const images = new Map([['/uploads/products/a.png', jpeg()]])

describe('nombre del archivo y fecha', () => {
  it('Catalogo - <nombre> - AAAA-MM-DD.docx con la fecha local', () => {
    expect(catalogFileName('Bazar Doña Lupe', DATE)).toBe('Catalogo - Bazar Doña Lupe - 2026-10-21.docx')
    expect(catalogFileName('Bazar', new Date(2026, 0, 5))).toBe('Catalogo - Bazar - 2026-01-05.docx')
  })

  it('quita lo que un sistema de archivos rechaza y nunca queda vacío', () => {
    expect(catalogFileName('Mi: "negocio" / <1>?', DATE)).toBe('Catalogo - Mi negocio 1 - 2026-10-21.docx')
    expect(catalogFileName('   ', DATE)).toBe('Catalogo - La Marchanta - 2026-10-21.docx')
  })

  it('la fecha larga va en español', () => {
    expect(longDate(DATE)).toBe('21 de octubre de 2026')
  })
})

describe('fitPhoto', () => {
  it('cabe en la celda y conserva la proporción, sin agrandar', () => {
    // 400x300 en una celda de 300 px: el alto máximo (200) manda.
    expect(fitPhoto({ width: 400, height: 300 }, 300)).toEqual({ width: 267, height: 200 })
    const small = fitPhoto({ width: 100, height: 50 }, 600)
    expect(small).toEqual({ width: 100, height: 50 })
    const tall = fitPhoto({ width: 300, height: 900 }, 600)
    expect(tall.height).toBeLessThanOrEqual(200)
    expect(Math.abs(tall.width / tall.height - 300 / 900)).toBeLessThan(0.02)
  })
})

describe('generateCatalogDocx', () => {
  it('produce un .docx válido (ZIP con las partes de Word)', async () => {
    const result = await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())
    expect(result.blob.type).toBe(DOCX_MIME)
    expect(result.blob.size).toBe(result.bytes.length)
    const { zip } = await open(result.bytes)
    for (const part of ['[Content_Types].xml', 'word/document.xml', 'word/styles.xml']) expect(zip.file(part)).toBeTruthy()
  })

  it('el documento trae el negocio, categorías, el grupo de variantes, "Pieza única" y "Otros"', async () => {
    const { document } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    expect(document).toContain('Bazar Doña Lupe')
    expect(document).toContain('>Ropa<')
    expect(document).toContain('>Hogar<')
    expect(document).toContain('>Otros<')
    // Las dos playeras son UN producto con dos variantes.
    expect(document.match(/>Playera Básica</g)).toHaveLength(1)
    expect(document).toContain('>S<')
    expect(document).toContain('>M<')
    expect(document).toContain('$150.00')
    expect(document).toContain('$155.00')
    expect(document).toContain('Pieza única')
    expect(document).toContain('Agotado')
    expect(document).toContain('Óleo sobre tela')
    expect(document).toContain(CONTACT_PLACEHOLDER)
    expect(document).toContain('Precios y existencias al 21 de octubre de 2026')
  })

  it('"Otros" queda al final y las demás categorías en orden alfabético', async () => {
    const { document } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    const at = (needle: string) => document.indexOf(`>${needle}<`)
    expect(at('Hogar')).toBeLessThan(at('Ropa'))
    expect(at('Ropa')).toBeLessThan(at('Otros'))
  })

  it('styles.xml trae los estilos con nombre', async () => {
    const { styles } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    for (const name of ['Title', 'heading 1', 'heading 2', 'Normal', 'Producto Detalle', 'Producto Precio']) {
      expect(styles.toLowerCase()).toContain(`w:name w:val="${name.toLowerCase()}"`)
    }
    expect(styles).toContain('Calibri')
    // Los estilos propios se usan de verdad en el cuerpo.
    const { document } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    for (const id of ['Title', 'Heading1', 'Heading2', 'ProductoDetalle', 'ProductoPrecio']) expect(document).toContain(`w:pStyle w:val="${id}"`)
  })

  it('sin colores llamativos: ningún estilo fija un color con tono', async () => {
    const { styles } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    // Negro o gris (r = g = b) es neutro; cualquier color con tono (los azules de Word) no.
    const colors = [...styles.matchAll(/<w:color [^>]*w:val="([0-9A-Fa-f]{6})"/g)].map((match) => match[1]!)
    const tinted = colors.filter((hex) => !(hex.slice(0, 2) === hex.slice(2, 4) && hex.slice(2, 4) === hex.slice(4, 6)))
    expect(tinted).toEqual([])
  })

  it('NO aparece ningún campo ni valor de costo, proveedor o notas', async () => {
    const result = await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())
    const { zip } = await open(result.bytes)
    for (const path of Object.keys(zip.files).filter((name) => name.endsWith('.xml') || name.endsWith('.rels'))) {
      const xml = await zip.file(path)!.async('string')
      for (const forbidden of ['987654', '9876.54', 'Proveedor Secreto', 'nota interna', 'purchaseCost', 'supplier']) {
        expect(xml, `${path} contiene ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('con las fotos apagadas el archivo no trae medios', async () => {
    const off = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options({ fields: { ...DEFAULT_CATALOG_DOC_OPTIONS.fields, photo: false } }))).bytes)
    expect(Object.keys(off.zip.files).filter((name) => name.startsWith('word/media/'))).toEqual([])
    expect(off.document).not.toContain('<w:drawing>')
  })

  it('con las fotos prendidas inserta la foto del producto y el marcador de los demás', async () => {
    const on = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    expect(on.document.match(/<w:drawing>/g)).toHaveLength(3)
    expect(Object.keys(on.zip.files).some((name) => name.startsWith('word/media/'))).toBe(true)
  })

  it('portada en su propia sección sin pie; el cuerpo lleva número de página', async () => {
    const { document, zip } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    const sections = document.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? []
    expect(sections).toHaveLength(3)
    expect(sections[0]).not.toContain('footerReference')
    expect(sections[0]).not.toContain('headerReference')
    expect(sections[1]).toContain('footerReference')
    const footers = await Promise.all(Object.keys(zip.files).filter((name) => /^word\/footer\d+\.xml$/.test(name)).map((name) => zip.file(name)!.async('string')))
    expect(footers.some((xml) => xml.includes('PAGE'))).toBe(true)
  })

  it('la leyenda de la fecha se puede apagar', async () => {
    const { document } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options({ showDate: false }))).bytes)
    expect(document).not.toContain('Precios y existencias al')
  })

  it('el índice es un campo nativo de Word y activa la actualización al abrir; apagado no hay ni campo ni ajuste', async () => {
    const on = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options({ tableOfContents: true }))).bytes)
    expect(on.document).toMatch(/TOC\s+\\h/)
    expect(await on.read('word/settings.xml')).toContain('w:updateFields')

    const off = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    expect(off.document).not.toMatch(/\bTOC\b/)
    expect(await off.read('word/settings.xml')).not.toContain('w:updateFields')
  })

  it('cada categoría empieza en página nueva si se pide, y no si no', async () => {
    const on = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options({ pageBreakPerCategory: true }))).bytes)
    expect(on.document.match(/<w:pageBreakBefore/g)).toHaveLength(2) // 3 categorías: la primera no necesita salto
    const off = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options({ pageBreakPerCategory: false }))).bytes)
    expect(off.document).not.toContain('<w:pageBreakBefore')
  })

  it.each([1, 2, 3] as const)('tabla sin bordes de %i columna(s)', async (columns) => {
    const { document } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options({ columns }))).bytes)
    const grids = [...document.matchAll(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/g)].map((match) => (match[1]!.match(/<w:gridCol/g) ?? []).length)
    expect(grids).toContain(columns)
    expect(document).toContain('<w:tblBorders>')
    expect(document).not.toMatch(/<w:top w:val="single"/)
  })

  it('apagar un dato lo quita del documento y no deja huecos', async () => {
    const full = sampleData()
    const off = (key: keyof CatalogDocOptions['fields']) => ({ fields: { ...DEFAULT_CATALOG_DOC_OPTIONS.fields, [key]: false } })
    const read = async (extra: Partial<CatalogDocOptions>) => (await open((await generateCatalogDocx(full, images, PLACEHOLDER, options(extra))).bytes)).document
    expect(await read(off('brand'))).not.toContain('>Sol<')
    expect(await read(off('description'))).not.toContain('Óleo sobre tela')
    expect(await read(off('price'))).not.toContain('$150.00')
    const noStock = await read(off('stock'))
    expect(noStock).not.toContain('Pieza única')
    expect(noStock).not.toContain('Agotado')
    const noPresentation = await read(off('presentation'))
    expect(noPresentation).not.toContain('>S<')
    // Sin los tres datos de variante no hay tabla anidada de variantes.
    const bare = await read({ fields: { ...DEFAULT_CATALOG_DOC_OPTIONS.fields, presentation: false, price: false, stock: false, photo: false } })
    expect(bare).not.toContain('ProductoPrecio')
  })

  it('un catálogo sin productos igual se genera (portada y contraportada)', async () => {
    const empty = buildCatalogData([])
    const { document } = await open((await generateCatalogDocx(empty, new Map(), null, options())).bytes)
    expect(document).toContain('Bazar Doña Lupe')
    expect(document).toContain(CONTACT_PLACEHOLDER)
  })

  it('el texto de la leyenda y los datos son texto real, no imágenes', async () => {
    const { document } = await open((await generateCatalogDocx(sampleData(), images, PLACEHOLDER, options())).bytes)
    // Solo hay <w:drawing> por las fotos (3), nunca por el texto.
    expect(document.match(/<w:drawing>/g)).toHaveLength(3)
  })
})
