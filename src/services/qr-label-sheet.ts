/**
 * Hoja de etiquetas QR en PDF (jsPDF). Solo DIBUJA el plan que arma
 * `utils/label-sheet-plan.ts`: el documento es A4 vertical en milímetros, así que
 * las coordenadas del plan entran tal cual.
 *
 * - jsPDF y `qrcode` se cargan de forma diferida: nadie los descarga hasta pedir la hoja.
 * - Cada QR se rasteriza UNA vez por id (PNG con un número entero de píxeles por
 *   módulo, ECC M, zona de silencio de 2 módulos) y se reutiliza con un alias: si un id
 *   se repite, el PDF lleva una sola imagen.
 * - Calidad de impresión: 12 px por módulo x 33 módulos = 396 px en 16,35 mm = ~615 ppp.
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

/** Píxeles por módulo del QR incrustado (entero: sin interpolar). */
export const LABEL_QR_SCALE = 12
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
    doc.addImage(images.get(label.id)!, 'PNG', label.qr.x, label.qr.y, label.qr.size, label.qr.size, label.id, 'NONE')
    for (const line of label.textLines) {
      // baseline 'top': `y` del plan es el borde superior del renglón.
      doc.text(line.text, line.x, line.y, { align: 'center', baseline: 'top' })
    }
  }

  doc.setProperties({ title: 'Etiquetas QR - La Marchanta', subject: `${plan.labels.length} etiquetas, ${plan.pages} hoja(s)` })
  return { doc, plan, blob: doc.output('blob') }
}
