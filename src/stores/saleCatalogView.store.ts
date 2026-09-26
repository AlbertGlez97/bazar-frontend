import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isSaleCatalogView, type SaleCatalogView } from '@/types/sale-catalog-view.types'

/**
 * Clave de localStorage de la vista del catálogo de venta. Es del dispositivo (como
 * el modo de interfaz), no de la persona ni de la sesión: cada teléfono o tablet
 * recuerda la suya.
 */
export const SALE_CATALOG_VIEW_STORAGE_KEY = 'la-marchanta-sale-catalog-view'

// localStorage puede lanzar (modo privado, cuota, permisos): si falla, la vista
// sigue funcionando en memoria y solo se pierde la persistencia.
function readStoredView(): SaleCatalogView | null {
  try {
    const raw = localStorage.getItem(SALE_CATALOG_VIEW_STORAGE_KEY)
    return isSaleCatalogView(raw) ? raw : null // valor inválido ⇒ "sin preferencia"
  } catch {
    return null
  }
}

function persistView(view: SaleCatalogView) {
  try {
    localStorage.setItem(SALE_CATALOG_VIEW_STORAGE_KEY, view)
  } catch {
    // Sin persistencia: la vista vale solo para esta carga de la app.
  }
}

/**
 * Vista del catálogo en la pantalla de venta (cuadrícula o lista).
 *
 * Sin preferencia guardada arranca en cuadrícula, la vista de siempre, y NO
 * escribe nada: solo se guarda cuando la persona elige.
 */
export const useSaleCatalogViewStore = defineStore('saleCatalogView', () => {
  const view = ref<SaleCatalogView>(readStoredView() ?? 'grid')

  function setView(next: SaleCatalogView) {
    if (!isSaleCatalogView(next)) return
    view.value = next
    persistView(next)
  }

  return { view, setView }
})
