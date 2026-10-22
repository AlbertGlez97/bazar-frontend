/**
 * Hoja de etiquetas QR en PDF (jsPDF). Solo DIBUJA el plan que arma
 * `utils/label-sheet-plan.ts`: el documento es CARTA vertical en milímetros (30 etiquetas
 * por hoja, 3 x 10), así que las coordenadas del plan entran tal cual.
 *
 * - jsPDF y `qrcode` se cargan de forma diferida: nadie los descarga hasta pedir la hoja.
 * - Cada QR se rasteriza UNA vez por id (PNG con un número entero de píxeles por
 *   módulo, ECC M, zona de silencio de 2 módulos) y se reutiliza con un alias: si un id
 *   se repite, el PDF lleva una sola imagen.
 * - Calidad de impresión: 8 px por módulo x 33 módulos (29 del UUID + 2 de silencio por lado)
 *   = 264 px en 20 mm = ~335 ppp (cada módulo mide ~0,61 mm y es un número ENTERO de
 *   píxeles: bordes nítidos).
 * - Tamaño del PDF: con compresión 'NONE' jsPDF incrusta los píxeles crudos (~470 kB por etiqueta
 *   única a 12 px/módulo: unas cuantas hojas cuelgan el teléfono). Un QR es casi todo blanco/negro
 *   plano y se comprime muchísimo: con deflate nivel 9 ('SLOW') una hoja de etiquetas únicas pesa
 *   un puñado de kB por etiqueta. Nunca 'NONE'.
 * - Texto: fuente base Helvetica (Latin-1 + «…»). Lo que no cabe se sanea en el plan y el
 *   recorte se mide con `doc.getTextWidth` (ancho real), no por número de caracteres.
 */
import { productQrDataUrl } from '@/utils/product-qr'
import {
  DEFAULT_CALIBRATION,
  DEFAULT_LABEL_DESIGN,
  planLabelSheet,
  type LabelCalibration,
  type LabelDesign,
  type LabelInput,
  type LabelSheetPlan,
} from '@/utils/label-sheet-plan'

/**
 * Píxeles por módulo del QR incrustado (entero: sin interpolar). 8 -> ~335 ppp a 20 mm,
 * por encima de los 300 ppp que pide una impresión nítida; más pesa más sin mejorar lo que
 * se ve en una etiqueta.
 */
export const LABEL_QR_SCALE = 8
/** Compresión de las imágenes en el PDF. NUNCA 'NONE' (ver arriba); 'SLOW' = deflate nivel 9, el más chico. */
export const LABEL_IMAGE_COMPRESSION = 'SLOW'
/** Módulos blancos alrededor del QR dentro de la imagen (el papel blanco de la etiqueta suma más). */
export const LABEL_QR_QUIET_ZONE = 2

type JsPdfModule = typeof import('jspdf')
export type LabelSheetDoc = InstanceType<JsPdfModule['jsPDF']>

export interface QrLabelSheet {
  doc: LabelSheetDoc
  plan: LabelSheetPlan
  /** El PDF listo para descargar o abrir. */
  blob: Blob
}

/** Arma la hoja: plan -> imágenes QR -> PDF. Lanza si no hay productos o algún id no es un UUID. */
export async function generateQrLabelSheet(
  products: readonly LabelInput[],
  calibration: LabelCalibration = DEFAULT_CALIBRATION,
  design: LabelDesign = DEFAULT_LABEL_DESIGN,
): Promise<QrLabelSheet> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait', compress: true })

  // El plan mide con la fuente real del documento; también valida antes de dibujar nada.
  const plan = planLabelSheet(products, calibration, design, (text, fontPt, bold) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(fontPt)
    return doc.getTextWidth(text)
  })

  const images = new Map<string, string>()
  for (const label of plan.labels) {
    if (!images.has(label.id)) {
      images.set(label.id, await productQrDataUrl(label.id, { scale: LABEL_QR_SCALE, quietZone: LABEL_QR_QUIET_ZONE }))
    }
  }

  let page = 0
  for (const label of plan.labels) {
    if (label.page !== page) {
      doc.addPage('letter', 'portrait')
      page = label.page
    }
    // alias = id: jsPDF incrusta la imagen una sola vez aunque el id se repita.
    doc.addImage(images.get(label.id)!, 'PNG', label.qr.x, label.qr.y, label.qr.size, label.qr.size, label.id, LABEL_IMAGE_COMPRESSION)
    for (const line of label.textLines) {
      doc.setFont('helvetica', line.bold ? 'bold' : 'normal')
      doc.setFontSize(line.fontPt)
      // baseline 'top': `y` del plan es el borde superior del renglón.
      doc.text(line.text, line.x, line.y, { baseline: 'top' })
    }
  }

  doc.setProperties({ title: 'Etiquetas QR - La Marchanta', subject: `${plan.labels.length} etiquetas, ${plan.pages} hoja(s)` })
  return { doc, plan, blob: doc.output('blob') }
}
