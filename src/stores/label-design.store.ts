import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_LABEL_DESIGN, isLabelDesign, type LabelDesign } from '@/utils/label-sheet-plan'

/** Clave de `localStorage` con el diseño de etiqueta elegido (`qr-only` o `qr-detail`). */
export const LABEL_DESIGN_STORAGE_KEY = 'la-marchanta-label-design'

/** Lee y VALIDA lo guardado; valor desconocido o almacenamiento bloqueado -> diseño por omisión. */
function readSaved(): LabelDesign {
  try {
    const raw = localStorage.getItem(LABEL_DESIGN_STORAGE_KEY)
    return isLabelDesign(raw) ? raw : DEFAULT_LABEL_DESIGN
  } catch {
    return DEFAULT_LABEL_DESIGN
  }
}

/** Diseño de etiqueta de todo el lote ("Solo QR" o "QR + detalle"). Se guarda al cambiar. */
export const useLabelDesignStore = defineStore('label-design', () => {
  const design = ref<LabelDesign>(readSaved())

  function set(next: LabelDesign) {
    if (!isLabelDesign(next)) return
    design.value = next
    try {
      localStorage.setItem(LABEL_DESIGN_STORAGE_KEY, next)
    } catch {
      // Sin almacenamiento (modo privado, bloqueado): el diseño sigue valiendo en esta sesión.
    }
  }

  return { design, set }
})
