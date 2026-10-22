/**
 * Catálogo en Word (.docx) — una BASE EDITABLE: quien lo reciba le pone el diseño, los
 * colores y sus datos de contacto. Por eso el trabajo está en la estructura y en los estilos
 * de Word, no en el diseño final.
 *
 * - Librería `docx` (dolanmiu), cargada con `import()` diferido como jsPDF: nadie la baja
 *   hasta pedir el catálogo.
 * - Estilos REALES de Word con nombre (cambiar el color o la fuente en un solo lugar):
 *   Title, Heading 1 (categoría), Heading 2 (producto), Normal y los propios "Producto
 *   Detalle" y "Producto Precio". Fuente base neutra (Calibri), sin colores.
 * - Estructura: portada (sección sin encabezado ni pie) -> índice opcional (campo nativo de
 *   TOC) -> cuerpo (un Heading 1 por categoría, tabla sin bordes de 1 a 3 columnas, número de
 *   página en el pie) -> contraportada con un texto guía.
 * - Todo es texto real y editable; las fotos son imágenes JPEG ya reducidas.
 */
import type * as Docx from 'docx'
import type { CatalogData, CatalogEntry, CatalogVariant } from '@/types/catalog.types'
import type { ReducedImage } from '@/services/catalog-images'
import { formatMinorMoney } from '@/utils/money'

export interface CatalogDocOptions {
  businessName: string
  /** Leyenda "Precios y existencias al <fecha>" en la portada. */
  showDate: boolean
  date: Date
  /** Índice (campo de tabla de contenido de Word). */
  tableOfContents: boolean
  pageBreakPerCategory: boolean
  columns: 1 | 2 | 3
  fields: {
    photo: boolean
    brand: boolean
    presentation: boolean
    description: boolean
    price: boolean
    stock: boolean
  }
}

export const DEFAULT_CATALOG_DOC_OPTIONS: Omit<CatalogDocOptions, 'businessName' | 'date'> = {
  showDate: true,
  tableOfContents: false,
  pageBreakPerCategory: true,
  columns: 2,
  fields: { photo: true, brand: true, presentation: true, description: true, price: true, stock: true },
}

export interface CatalogDocument {
  blob: Blob
  bytes: Uint8Array
}

// Hoja Carta con márgenes de 1": 6.5" de ancho útil = 9360 twips = 624 px a 96 ppp.
const CONTENT_WIDTH_TWIPS = 9360
const CELL_PADDING_TWIPS = 100
const PX_PER_TWIP = 96 / 1440
const MAX_PHOTO_HEIGHT_PX = 200
const PHOTO_SIDE_PADDING_PX = 8

export const STYLE = {
  title: 'Title',
  category: 'Heading1',
  product: 'Heading2',
  normal: 'Normal',
  detail: 'ProductoDetalle',
  price: 'ProductoPrecio',
  tocTitle: 'IndiceTitulo',
} as const

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const CONTACT_PLACEHOLDER = 'Aquí tus datos de contacto'
export const TOC_TITLE = 'Índice'

const DATE_FORMAT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })

/** "21 de octubre de 2026". */
export function longDate(date: Date): string {
  return DATE_FORMAT.format(date)
}

/** `Catalogo - <nombre> - AAAA-MM-DD.docx`, con la fecha LOCAL y sin caracteres que un sistema de archivos rechaza. */
export function catalogFileName(businessName: string, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const name = businessName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').split(/\s+/).join(' ').trim().slice(0, 80) || 'La Marchanta'
  return `Catalogo - ${name} - ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.docx`
}

/** Tamaño en píxeles con que se inserta una foto: cabe en la celda, misma proporción. */
export function fitPhoto(image: Pick<ReducedImage, 'width' | 'height'>, cellWidthPx: number): { width: number; height: number } {
  const maxWidth = Math.max(40, cellWidthPx - PHOTO_SIDE_PADDING_PX)
  const scale = Math.min(maxWidth / image.width, MAX_PHOTO_HEIGHT_PX / image.height, 1)
  return { width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) }
}

type DocxModule = typeof Docx

/** Qué columnas lleva la tabla de variantes de un producto (según los datos elegidos). */
function variantColumns(fields: CatalogDocOptions['fields']): ('presentation' | 'price' | 'stock')[] {
  const columns: ('presentation' | 'price' | 'stock')[] = []
  if (fields.presentation) columns.push('presentation')
  if (fields.price) columns.push('price')
  if (fields.stock) columns.push('stock')
  return columns
}

const COLUMN_WEIGHT = { presentation: 4, price: 3, stock: 3 } as const

function buildStyles(d: DocxModule): Docx.IStylesOptions {
  const font = 'Calibri'
  const neutralHeading = { run: { font, size: 24, bold: true, color: '000000' } }
  return {
    default: {
      document: { run: { font, size: 22 }, paragraph: { spacing: { after: 80 } } },
      title: { run: { font, size: 64, bold: true }, paragraph: { alignment: d.AlignmentType.CENTER, spacing: { after: 200 } } },
      heading1: { run: { font, size: 36, bold: true }, paragraph: { spacing: { before: 240, after: 160 }, keepNext: true } },
      heading2: { run: { font, size: 26, bold: true }, paragraph: { spacing: { before: 120, after: 60 }, keepNext: true } },
      // Los demás estilos de Word traen azules propios: se dejan en negro para que la base sea neutra.
      heading3: neutralHeading,
      heading4: neutralHeading,
      heading5: neutralHeading,
      heading6: neutralHeading,
      hyperlink: { run: { color: '000000' } },
    },
    paragraphStyles: [
      { id: STYLE.normal, name: 'Normal', quickFormat: true, run: { font, size: 22 }, paragraph: { spacing: { after: 80 } } },
      {
        id: STYLE.detail,
        name: 'Producto Detalle',
        basedOn: STYLE.normal,
        quickFormat: true,
        run: { font, size: 20 },
        paragraph: { spacing: { after: 40 } },
      },
      {
        id: STYLE.price,
        name: 'Producto Precio',
        basedOn: STYLE.normal,
        quickFormat: true,
        run: { font, size: 22, bold: true },
        paragraph: { alignment: d.AlignmentType.RIGHT, spacing: { after: 40 } },
      },
      {
        id: STYLE.tocTitle,
        name: 'Indice Titulo',
        basedOn: STYLE.normal,
        quickFormat: true,
        run: { font, size: 36, bold: true },
        paragraph: { spacing: { after: 160 } },
      },
    ],
  }
}

export async function generateCatalogDocx(
  data: CatalogData,
  images: ReadonlyMap<string, ReducedImage>,
  placeholder: ReducedImage | null,
  options: CatalogDocOptions,
): Promise<CatalogDocument> {
  const d: DocxModule = await import('docx')
  const { fields } = options

  const noBorder = { style: d.BorderStyle.NONE, size: 0, color: 'auto' } as const
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder }

  const columnTwips = Math.floor(CONTENT_WIDTH_TWIPS / options.columns)
  const innerTwips = columnTwips - 2 * CELL_PADDING_TWIPS
  const columnPx = Math.floor(columnTwips * PX_PER_TWIP)

  const text = (value: string, style: string, alignment?: (typeof d.AlignmentType)[keyof typeof d.AlignmentType]) =>
    new d.Paragraph({ style, alignment, children: [new d.TextRun(value)] })

  const variantTable = (variants: readonly CatalogVariant[]): Docx.Table | null => {
    const columns = variantColumns(fields)
    if (columns.length === 0) return null
    const totalWeight = columns.reduce((sum, column) => sum + COLUMN_WEIGHT[column], 0)
    const widths = columns.map((column) => Math.floor((innerTwips * COLUMN_WEIGHT[column]) / totalWeight))
    const cellText = (variant: CatalogVariant, column: (typeof columns)[number]) => {
      if (column === 'presentation') return text(variant.presentation, STYLE.detail)
      if (column === 'price') return text(formatMinorMoney(variant.unitPriceMinor), STYLE.price)
      return text(variant.stockLabel, STYLE.detail, d.AlignmentType.RIGHT)
    }
    return new d.Table({
      width: { size: widths.reduce((a, b) => a + b, 0), type: d.WidthType.DXA },
      columnWidths: widths,
      layout: d.TableLayoutType.FIXED,
      borders: noBorders,
      rows: variants.map(
        (variant) =>
          new d.TableRow({
            cantSplit: true,
            children: columns.map(
              (column, i) =>
                new d.TableCell({
                  width: { size: widths[i]!, type: d.WidthType.DXA },
                  borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
                  margins: { top: 0, bottom: 0, left: 0, right: 60 },
                  children: [cellText(variant, column)],
                }),
            ),
          }),
      ),
    })
  }

  const photoOf = (entry: CatalogEntry): ReducedImage | null =>
    (entry.image ? images.get(entry.image) : undefined) ?? placeholder

  const entryCell = (entry: CatalogEntry): Docx.TableCell => {
    const children: (Docx.Paragraph | Docx.Table)[] = []
    const photo = fields.photo ? photoOf(entry) : null
    if (photo) {
      children.push(
        new d.Paragraph({
          style: STYLE.normal,
          children: [
            new d.ImageRun({
              type: 'jpg',
              data: photo.bytes,
              transformation: fitPhoto(photo, columnPx),
              altText: { name: 'Foto', description: entry.name, title: entry.name },
            }),
          ],
        }),
      )
    }
    children.push(text(entry.name, STYLE.product))
    if (fields.brand && entry.brand) children.push(text(entry.brand, STYLE.normal))
    if (fields.description && entry.description) children.push(text(entry.description, STYLE.detail))
    const table = variantTable(entry.variants)
    if (table) {
      children.push(table)
      // Word exige un párrafo después de una tabla al final de la celda.
      children.push(new d.Paragraph({ style: STYLE.detail, children: [] }))
    }
    return new d.TableCell({
      width: { size: columnTwips, type: d.WidthType.DXA },
      margins: { top: CELL_PADDING_TWIPS, bottom: CELL_PADDING_TWIPS, left: CELL_PADDING_TWIPS, right: CELL_PADDING_TWIPS },
      verticalAlign: d.VerticalAlign.TOP,
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      children,
    })
  }

  const emptyCell = () =>
    new d.TableCell({
      width: { size: columnTwips, type: d.WidthType.DXA },
      borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
      children: [new d.Paragraph({ style: STYLE.normal, children: [] })],
    })

  const categoryTable = (entries: readonly CatalogEntry[]): Docx.Table => {
    const rows: Docx.TableRow[] = []
    for (let start = 0; start < entries.length; start += options.columns) {
      const slice = entries.slice(start, start + options.columns)
      const cells = slice.map(entryCell)
      while (cells.length < options.columns) cells.push(emptyCell())
      rows.push(new d.TableRow({ cantSplit: true, children: cells }))
    }
    return new d.Table({
      width: { size: columnTwips * options.columns, type: d.WidthType.DXA },
      columnWidths: Array.from({ length: options.columns }, () => columnTwips),
      layout: d.TableLayoutType.FIXED,
      borders: noBorders,
      rows,
    })
  }

  // ── Portada: su propia sección, SIN encabezado ni pie ──────────────────────
  const cover: Docx.FileChild[] = [text(options.businessName, STYLE.title)]
  if (options.showDate) cover.push(text(`Precios y existencias al ${longDate(options.date)}`, STYLE.normal, d.AlignmentType.CENTER))

  // ── Cuerpo ─────────────────────────────────────────────────────────────────
  const body: Docx.FileChild[] = []
  if (options.tableOfContents) {
    body.push(text(TOC_TITLE, STYLE.tocTitle))
    // Solo las categorías (Heading 1); Word llena el campo al abrir el archivo.
    body.push(new d.TableOfContents(TOC_TITLE, { hyperlink: true, headingStyleRange: '1-1' }))
  }
  data.categories.forEach((category, index) => {
    const startsOnNewPage = options.pageBreakPerCategory && (index > 0 || options.tableOfContents)
    body.push(
      new d.Paragraph({
        style: STYLE.category,
        pageBreakBefore: startsOnNewPage,
        children: [new d.TextRun(category.name)],
      }),
    )
    body.push(categoryTable(category.entries))
    // Un párrafo entre tablas: Word junta dos tablas pegadas en una sola.
    body.push(new d.Paragraph({ style: STYLE.normal, children: [] }))
  })

  const pageFooter = new d.Footer({
    children: [new d.Paragraph({ style: STYLE.normal, alignment: d.AlignmentType.CENTER, children: [new d.TextRun({ children: [d.PageNumber.CURRENT] })] })],
  })

  const document = new d.Document({
    creator: options.businessName,
    title: `Catálogo - ${options.businessName}`,
    styles: buildStyles(d),
    // Con índice, Word llena el campo al abrir (pregunta antes); sin índice no se toca el ajuste.
    features: options.tableOfContents ? { updateFields: true } : undefined,
    sections: [
      { properties: { verticalAlign: d.VerticalAlignSection.CENTER }, children: cover },
      {
        properties: { type: d.SectionType.NEXT_PAGE, page: { pageNumbers: { start: 1 } } },
        footers: { default: pageFooter },
        children: body.length > 0 ? body : [text('', STYLE.normal)],
      },
      {
        properties: { type: d.SectionType.NEXT_PAGE, verticalAlign: d.VerticalAlignSection.CENTER },
        // Pie vacío a propósito: sin esto heredaría el número de página del cuerpo.
        footers: { default: new d.Footer({ children: [new d.Paragraph({ children: [] })] }) },
        children: [text(CONTACT_PLACEHOLDER, STYLE.normal, d.AlignmentType.CENTER)],
      },
    ],
  })

  const buffer = await d.Packer.toArrayBuffer(document)
  return { blob: new Blob([buffer], { type: DOCX_MIME }), bytes: new Uint8Array(buffer) }
}
