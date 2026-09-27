/**
 * Hoja de etiquetas QR en PDF (jsPDF). Solo DIBUJA el plan que arma
 * `utils/label-sheet-plan.ts`: el documento es A4 vertical en milímetros, así que
 * las coordenadas del plan entran tal cual.
 *
 * - jsPDF y `qrcode` se cargan de forma diferida: nadie los descarga hasta pedir la hoja.
 * - Cada QR se rasteriza UNA vez por id (PNG con un número entero de píxeles por
 *   módulo, ECC M, zona de silencio de 2 módulos) y se reutiliza con un alias: si un id
 *   se repite, el PDF lleva una sola imagen.
 * - Calidad de impresión: 8 px por módulo x 33 módulos = 264 px en 16,35 mm = ~410 ppp
 *   (cada módulo mide 0,495 mm y es un número ENTERO de píxeles: bordes nítidos).
 * - Tamaño del PDF: con compresión 'NONE' jsPDF incrusta los píxeles crudos (~470 kB por etiqueta
 *   única a 12 px/módulo: 32 MB por hoja de 72, y unas cuantas hojas cuelgan el teléfono). Un QR es
 *   casi todo blanco/negro plano y se comprime muchísimo: con deflate nivel 9 ('SLOW') una hoja de
 *   72 etiquetas únicas pesa ~100 kB y una de 144, ~190 kB. Medido con jsPDF real (72 / 144 únicas):
 *   NONE 33 MB / 66 MB; 12 px FAST 583 / 1164 kB; 12 px SLOW 133 / 264 kB; 8 px SLOW 98 / 193 kB.
 * - Texto: fuente base Helvetica (Latin-1). Lo que no cabe se sanea en el plan.
 */
import { productQrDataUrl } from '@/utils/product-qr'
import {
  DEFAULT_CALIBRATION,
  NAME_FONT_PT,
  planLabelSheet,
  type LabelCalibration,
  type LabelInput,
  type LabelSheetPlan,
} from '@/utils/label-sheet-plan'

/**
 * Píxeles por módulo del QR incrustado (entero: sin interpolar). 8 -> ~410 ppp a 16,35 mm,
 * por encima de los 300 ppp que pide una impresión nítida; 12 (~615 ppp) pesa el doble y tarda
 * el doble en generar sin mejorar lo que se ve en una etiqueta de 35 mm.
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
): Promise<QrLabelSheet> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(NAME_FONT_PT)

  // El plan mide con la fuente real del documento; también valida antes de dibujar nada.
  const plan = planLabelSheet(products, calibration, (text) => doc.getTextWidth(text))

  const images = new Map<string, string>()
  for (const label of plan.labels) {
    if (!images.has(label.id)) {
      images.set(label.id, await productQrDataUrl(label.id, { scale: LABEL_QR_SCALE, quietZone: LABEL_QR_QUIET_ZONE }))
    }
  }

  let page = 0
  for (const label of plan.labels) {
    if (label.page !== page) {
      doc.addPage('a4', 'portrait')
      page = label.page
    }
    // alias = id: jsPDF incrusta la imagen una sola vez aunque el id se repita.
    doc.addImage(images.get(label.id)!, 'PNG', label.qr.x, label.qr.y, label.qr.size, label.qr.size, label.id, LABEL_IMAGE_COMPRESSION)
    for (const line of label.textLines) {
      // baseline 'top': `y` del plan es el borde superior del renglón.
      doc.text(line.text, line.x, line.y, { align: 'center', baseline: 'top' })
    }
  }

  doc.setProperties({ title: 'Etiquetas QR - La Marchanta', subject: `${plan.labels.length} etiquetas, ${plan.pages} hoja(s)` })
  return { doc, plan, blob: doc.output('blob') }
}
