import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isManageCatalogView, type ManageCatalogView } from '@/types/manage-catalog-view.types'

/**
 * Clave de localStorage de la vista del catálogo de Gestión. Es del dispositivo
 * (como el modo de interfaz), no de la persona ni de la sesión: cada teléfono
 * o tablet recuerda la suya. Distinta de la de Venta (`saleCatalogView.store.ts`):
 * cada pantalla guarda su propia preferencia.
 */
export const MANAGE_CATALOG_VIEW_STORAGE_KEY = 'la-marchanta-manage-catalog-view'

// localStorage puede lanzar (modo privado, cuota, permisos): si falla, la vista
// sigue funcionando en memoria y solo se pierde la persistencia.
function readStoredView(): ManageCatalogView | null {
  try {
    const raw = localStorage.getItem(MANAGE_CATALOG_VIEW_STORAGE_KEY)
    return isManageCatalogView(raw) ? raw : null // valor inválido ⇒ "sin preferencia"
  } catch {
    return null
  }
}

function persistView(view: ManageCatalogView) {
  try {
    localStorage.setItem(MANAGE_CATALOG_VIEW_STORAGE_KEY, view)
  } catch {
    // Sin persistencia: la vista vale solo para esta carga de la app.
  }
}

/**
 * Vista del catálogo en la pantalla de Gestión (cuadrícula o lista).
 *
 * Sin preferencia guardada arranca en cuadrícula, la vista de siempre, y NO
 * escribe nada: solo se guarda cuando la persona elige.
 */
export const useManageCatalogViewStore = defineStore('manageCatalogView', () => {
  const view = ref<ManageCatalogView>(readStoredView() ?? 'grid')

  function setView(next: ManageCatalogView) {
    if (!isManageCatalogView(next)) return
    view.value = next
    persistView(next)
  }

  return { view, setView }
})
