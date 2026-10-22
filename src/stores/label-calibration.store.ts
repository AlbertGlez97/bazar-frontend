import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DEFAULT_CALIBRATION, isDefaultCalibration, normalizeCalibration, type LabelCalibration } from '@/utils/label-sheet-plan'

/** Clave de `localStorage` con la calibración de la impresora (JSON con los seis valores de `LabelCalibration`). */
export const LABEL_CALIBRATION_STORAGE_KEY = 'la-marchanta-label-calibration'

/** Lee y VALIDA lo guardado; JSON roto, otro tipo o almacenamiento bloqueado -> valores por omisión. */
function readSaved(): LabelCalibration {
  try {
    const raw = localStorage.getItem(LABEL_CALIBRATION_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CALIBRATION }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ...DEFAULT_CALIBRATION }
    return normalizeCalibration(parsed)
  } catch {
    return { ...DEFAULT_CALIBRATION }
  }
}

function save(calibration: LabelCalibration): void {
  try {
    localStorage.setItem(LABEL_CALIBRATION_STORAGE_KEY, JSON.stringify(calibration))
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): la calibración sigue valiendo en esta sesión.
  }
}

/**
 * Calibración de la hoja de etiquetas: márgenes, ancho, alto, separación horizontal y paso
 * vertical (mm). Se guarda al cambiar, para no recalibrar cada vez que se imprime.
 */
export const useLabelCalibrationStore = defineStore('label-calibration', () => {
  const calibration = ref<LabelCalibration>(readSaved())

  const isDefault = computed(() => isDefaultCalibration(calibration.value))

  /** Cambia uno o varios valores (validados y redondeados a 2 decimales) y los guarda. */
  function set(partial: Partial<LabelCalibration>) {
    calibration.value = normalizeCalibration({ ...calibration.value, ...partial })
    save(calibration.value)
  }

  function reset() {
    calibration.value = { ...DEFAULT_CALIBRATION }
    save(calibration.value)
  }

  return { calibration, isDefault, set, reset }
})
