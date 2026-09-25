import type { Content, TableCell, TDocumentDefinitions, TVirtualFileSystem } from 'pdfmake/interfaces'
import { REPORT_COLORS } from '@/config/report-palette'
import { formatBusinessDateTime } from '@/utils/business-time'
import { saveBlob } from '@/utils/report-files'
import { formatMinorMoney } from '@/utils/money'
import { plural, rangeDescription, reportNotes, roleLabel } from '@/utils/sales-report'
import type { SalesReport } from '@/types/report.types'

const C = REPORT_COLORS
const PAGE_MARGINS: [number, number, number, number] = [36, 36, 36, 48]

/**
 * Isotipo de La Marchanta (public/favicon.svg) con los mismos colores de la
 * marca. El toldo va con franjas y festón; pdfmake lo dibuja como vector.
 */
const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="${C.primary}"/>
<rect x="0" y="0" width="16" height="18" fill="${C.accent}"/><circle cx="8" cy="18" r="8" fill="${C.accent}"/>
<rect x="16" y="0" width="16" height="18" fill="${C.surface}"/><circle cx="24" cy="18" r="8" fill="${C.surface}"/>
<rect x="32" y="0" width="16" height="18" fill="${C.accent}"/><circle cx="40" cy="18" r="8" fill="${C.accent}"/>
<rect x="48" y="0" width="16" height="18" fill="${C.surface}"/><circle cx="56" cy="18" r="8" fill="${C.surface}"/>
<path d="M16 53V38l16 10 16-10v15" fill="none" stroke="${C.surface}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const headerCell = (text: string, alignment: 'left' | 'right' = 'left'): TableCell => ({
  text,
  bold: true,
  color: C.onPrimary,
  fillColor: C.primary,
  alignment,
  margin: [0, 2, 0, 2],
})

const cell = (text: string, alignment: 'left' | 'right' = 'left'): TableCell => ({ text, alignment })

function totalCell(text: string, alignment: 'left' | 'right' = 'left'): TableCell {
  return { text, alignment, bold: true, fillColor: C.primarySoft }
}

/** Tabla con encabezado terracota, filas cebra y líneas horizontales suaves. */
const TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0,
  hLineColor: () => C.border,
  paddingTop: () => 3,
  paddingBottom: () => 3,
  fillColor: (rowIndex: number) => (rowIndex > 0 && rowIndex % 2 === 0 ? C.surfaceAlt : null),
}

function noteBox(text: string): Content {
  return {
    table: { widths: ['*'], body: [[{ text, color: C.warning, fontSize: 9, margin: [4, 3, 4, 3] }]] },
    layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => C.warningSoft },
    margin: [0, 0, 0, 10],
  }
}

function salesTable(report: SalesReport): Content {
  const { totals } = report
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [88, '*', 50, 62, 62, 58],
      body: [
        [
          headerCell('Fecha'),
          headerCell('Persona'),
          headerCell('Artículos', 'right'),
          headerCell('Total', 'right'),
          headerCell('Efectivo', 'right'),
          headerCell('Cambio', 'right'),
        ],
        ...report.rows.map((row) => [
          cell(formatBusinessDateTime(row.receivedAt)),
          cell(row.sellerName),
          cell(String(row.articleCount), 'right'),
          cell(formatMinorMoney(row.totalMinor), 'right'),
          cell(formatMinorMoney(row.cashReceivedMinor), 'right'),
          cell(formatMinorMoney(row.changeMinor), 'right'),
        ]),
        [
          totalCell('Total'),
          totalCell(plural(totals.saleCount, 'venta', 'ventas')),
          totalCell(String(totals.articleCount), 'right'),
          totalCell(formatMinorMoney(totals.totalMinor), 'right'),
          totalCell(formatMinorMoney(totals.cashReceivedMinor), 'right'),
          totalCell(formatMinorMoney(totals.changeMinor), 'right'),
        ],
      ],
    },
    layout: TABLE_LAYOUT,
    fontSize: 9,
  }
}

function peopleTable(report: SalesReport): Content {
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: ['*', 80, 40, 80, 62],
      body: [
        [
          headerCell('Persona'),
          headerCell('Rol'),
          headerCell('Ventas', 'right'),
          headerCell('Total vendido', 'right'),
          headerCell('% del total', 'right'),
        ],
        ...report.people.map((person) => [
          cell(person.name),
          cell(roleLabel(person.role)),
          cell(String(person.saleCount), 'right'),
          cell(formatMinorMoney(person.totalMinor), 'right'),
          cell(`${person.sharePercent.toFixed(1)} %`, 'right'),
        ]),
      ],
    },
    layout: TABLE_LAYOUT,
    fontSize: 9,
  }
}

/**
 * Definición del PDF de ventas (función pura: no toca pdfmake). El módulo de
 * pdfmake solo se carga en `renderPdfBlob`, al pedir el archivo.
 * Fuente: Roboto, la que trae pdfmake empaquetada (sin CDN, funciona sin
 * internet y cubre acentos, "ñ" y "$"). Las fuentes de marca (Bricolage,
 * Figtree) no se incrustan: pesarían cientos de KB por un archivo que se
 * imprime; la marca va en color, el isotipo y el encabezado.
 */
export function buildPdfDefinition(report: SalesReport): TDocumentDefinitions {
  const title = `Ventas del ${rangeDescription(report)}`
  const { totals } = report
  const hasSales = report.rows.length > 0

  const content: Content[] = [
    {
      columns: [
        { svg: MARK_SVG, width: 40 },
        {
          stack: [
            { text: report.businessName, fontSize: 18, bold: true, color: C.text },
            { text: title, fontSize: 12, color: C.primary, bold: true, margin: [0, 2, 0, 0] },
            { text: `Generado el ${formatBusinessDateTime(report.generatedAt)}`, fontSize: 9, color: C.textMuted, margin: [0, 2, 0, 0] },
          ],
          margin: [10, 0, 0, 0],
        },
      ],
    },
    // Filete terracota bajo el encabezado
    { canvas: [{ type: 'rect', x: 0, y: 0, w: 523, h: 2, color: C.primary }], margin: [0, 8, 0, 12] },
  ]

  for (const note of reportNotes(report)) content.push(noteBox(note))

  content.push({ text: 'Ventas', style: 'sectionTitle' })
  content.push(hasSales
    ? salesTable(report)
    : { text: 'Todavía no hay ventas en este periodo.', color: C.textMuted, margin: [0, 0, 0, 8] })

  if (hasSales) {
    content.push({ text: 'Por persona', style: 'sectionTitle', margin: [0, 16, 0, 6] })
    content.push(peopleTable(report))
  }

  content.push({
    stack: [
      { text: 'Total vendido', fontSize: 10, color: C.textMuted },
      { text: formatMinorMoney(totals.totalMinor), fontSize: 24, bold: true, color: C.primary },
      { text: `${plural(totals.saleCount, 'venta', 'ventas')} · ${plural(totals.articleCount, 'artículo', 'artículos')}`, fontSize: 10, color: C.textMuted },
    ],
    alignment: 'right',
    margin: [0, 18, 0, 0],
    unbreakable: true,
  })

  return {
    info: { title: `${title} - ${report.businessName}`, author: report.businessName, creator: report.businessName },
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: PAGE_MARGINS,
    defaultStyle: { font: 'Roboto', fontSize: 10, color: C.text },
    styles: {
      sectionTitle: { fontSize: 13, bold: true, color: C.text, margin: [0, 0, 0, 6] },
    },
    footer: (currentPage: number, pageCount: number): Content => ({
      columns: [
        { text: `${report.businessName} · ${title}`, fontSize: 8, color: C.textMuted },
        { text: `Página ${currentPage} de ${pageCount}`, fontSize: 8, color: C.textMuted, alignment: 'right' },
      ],
      margin: [36, 16, 36, 0],
    }),
    content,
  }
}

type PdfMakeApi = typeof import('pdfmake/build/pdfmake')

let pdfMakeReady: Promise<PdfMakeApi> | null = null

/**
 * Carga pdfmake y sus fuentes (Roboto, empaquetadas) SOLO al pedir un PDF: son
 * más de 1 MB que nadie necesita para ver los totales. El resultado se reutiliza
 * (las fuentes se registran una sola vez). Si la carga falla, el siguiente
 * intento vuelve a intentarlo. La build de navegador es UMD: se toma su
 * `default` si el empaquetador lo expone y, si no, el módulo entero.
 */
function loadPdfMake(): Promise<PdfMakeApi> {
  pdfMakeReady ??= (async () => {
    const [pdfMakeModule, fontsModule] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ])
    const pdfMake = ((pdfMakeModule as { default?: PdfMakeApi }).default ?? pdfMakeModule) as PdfMakeApi
    const fonts = ((fontsModule as { default?: TVirtualFileSystem }).default ?? fontsModule) as TVirtualFileSystem
    pdfMake.addVirtualFileSystem(fonts)
    return pdfMake
  })().catch((cause) => {
    pdfMakeReady = null
    throw cause
  })
  return pdfMakeReady
}

/** Genera el PDF como Blob (`application/pdf`). Carga pdfmake la primera vez. */
export async function renderPdfBlob(report: SalesReport): Promise<Blob> {
  const pdfMake = await loadPdfMake()
  return pdfMake.createPdf(buildPdfDefinition(report)).getBlob()
}

/** Genera el PDF y lo descarga con ese nombre. Si falla la generación no se guarda nada y el error se propaga. */
export async function downloadPdf(report: SalesReport, filename: string): Promise<void> {
  saveBlob(await renderPdfBlob(report), filename)
}
