import { shallowRef } from 'vue'
import type { ScanMode } from '@/types/scan.types'
import type { Product } from '@/types/product.types'
import { HAPTIC_OK, useHaptics } from './useHaptics'

/**
 * Qué hace el escáner con una lectura: agregarla a la venta (lo de siempre) o abrir la
 * ficha del producto encima del escáner. El modo NO persiste: cada vez que se abre el
 * escáner arranca en `initial`. Mientras la ficha está abierta las lecturas no hacen nada
 * (la ficha no cambia sola ni se agrega nada a escondidas).
 */
export function useProductSheetScan(initial: ScanMode = 'add') {
  const { vibrate } = useHaptics()
  const mode = shallowRef<ScanMode>(initial)
  const sheetProduct = shallowRef<Product | null>(null)

  /** Al abrir el escáner: el modo vuelve al inicial y no queda ninguna ficha abierta. */
  function reset() {
    mode.value = initial
    sheetProduct.value = null
  }

  /** Abre la ficha con una vibración corta. */
  function showSheet(product: Product) {
    vibrate(HAPTIC_OK)
    sheetProduct.value = product
  }

  function closeSheet() {
    sheetProduct.value = null
  }

  return { mode, sheetProduct, reset, showSheet, closeSheet }
}
