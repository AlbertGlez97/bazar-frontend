import { ref } from 'vue'
import { VOICE } from '@/config/voice'
import { useLabelCalibrationStore } from '@/stores/label-calibration.store'
import { labelSheetFileName, type LabelInput } from '@/utils/label-sheet-plan'
import { saveBlob } from '@/utils/report-files'

/** La URL del PDF de la vista previa vive un buen rato: la pestaña nueva la lee al abrir y al recargar. */
const PREVIEW_URL_LIFETIME_MS = 10 * 60 * 1000

/**
 * Vista previa y descarga de la hoja de etiquetas con la calibración GUARDADA.
 * El generador (jsPDF + qrcode, ~cientos de kB) se importa solo aquí, al pedir la hoja.
 */
export function useLabelPrinting() {
  const calibration = useLabelCalibrationStore()
  const busy = ref<'preview' | 'download' | null>(null)
  const error = ref('')

  async function build(products: readonly LabelInput[]) {
    const { generateQrLabelSheet } = await import('@/services/qr-label-sheet')
    return generateQrLabelSheet(products, { ...calibration.calibration })
  }

  async function download(products: readonly LabelInput[]): Promise<void> {
    if (busy.value || products.length === 0) return
    busy.value = 'download'
    error.value = ''
    try {
      const { blob } = await build(products)
      saveBlob(blob, labelSheetFileName())
    } catch {
      error.value = VOICE.labels.printError
    } finally {
      busy.value = null
    }
  }

  /**
   * Abre el PDF en una pestaña nueva. La pestaña se abre ANTES de generar (dentro del clic:
   * después de un `await` el navegador ya no la considera una acción de la persona y la
   * bloquea) y luego se apunta al PDF. Si el navegador la bloquea, se avisa.
   */
  async function preview(products: readonly LabelInput[]): Promise<void> {
    if (busy.value || products.length === 0) return
    error.value = ''
    const tab = window.open('about:blank', '_blank')
    if (!tab) {
      error.value = VOICE.labels.previewBlocked
      return
    }
    busy.value = 'preview'
    try {
      const { blob } = await build(products)
      const url = URL.createObjectURL(blob)
      tab.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), PREVIEW_URL_LIFETIME_MS)
    } catch {
      tab.close()
      error.value = VOICE.labels.printError
    } finally {
      busy.value = null
    }
  }

  return { busy, error, download, preview }
}
