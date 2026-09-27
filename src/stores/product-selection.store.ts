import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import ProductsService from '@/services/products.service'
import type { Product } from '@/types/product.types'

/** Lo mínimo de un producto que hace falta para imprimir su etiqueta. */
export interface SelectedProduct {
  id: string
  name: string
}

/** El servidor topa `limit` en 100: se pide de a 100 páginas. */
const PAGE_SIZE = 100

/**
 * Selección múltiple de productos del catálogo (para imprimir códigos QR).
 * Vive fuera de la lista visible a propósito: cambiar de página o de búsqueda no la
 * borra. Guarda `{id, name}` porque la etiqueta necesita el nombre y el producto
 * de otra página ya no está en pantalla. El orden de selección es el orden en la hoja.
 */
export const useProductSelectionStore = defineStore('product-selection', () => {
  const active = ref(false)
  const selected = ref(new Map<string, SelectedProduct>())
  const selectingAll = ref(false)
  const progress = ref<{ loaded: number; total: number } | null>(null)

  const count = computed(() => selected.value.size)
  const items = computed<SelectedProduct[]>(() => [...selected.value.values()])

  function enter() {
    active.value = true
  }

  /** Sale del modo selección y descarta lo elegido. */
  function exit() {
    active.value = false
    selected.value = new Map()
  }

  function clear() {
    selected.value = new Map()
  }

  function has(id: string): boolean {
    return selected.value.has(id)
  }

  /** Marca o desmarca. Un producto inactivo no se selecciona: su etiqueta no serviría. */
  function toggle(product: Pick<Product, 'id' | 'name' | 'active'>) {
    if (selected.value.has(product.id)) {
      selected.value.delete(product.id)
      return
    }
    if (!product.active) return
    selected.value.set(product.id, { id: product.id, name: product.name })
  }

  /**
   * Selecciona TODOS los productos ACTIVOS que coinciden con la búsqueda, de todas las
   * páginas (nunca pide inactivos). Todo o nada: si una página falla no se agrega nada y
   * el error se propaga. Devuelve cuántos se agregaron (los ya elegidos no cuentan).
   */
  async function selectAllMatching(search: string): Promise<number> {
    if (selectingAll.value) return 0
    selectingAll.value = true
    progress.value = { loaded: 0, total: 0 }
    try {
      const found: SelectedProduct[] = []
      let page = 1
      let total = 0
      do {
        const response = await ProductsService.listProducts({ page, limit: PAGE_SIZE, search: search || undefined })
        total = response.total
        for (const product of response.items) {
          if (product.active) found.push({ id: product.id, name: product.name })
        }
        progress.value = { loaded: Math.min(page * PAGE_SIZE, total), total }
        if (response.items.length === 0) break
        page += 1
      } while ((page - 1) * PAGE_SIZE < total)

      let added = 0
      for (const product of found) {
        if (!selected.value.has(product.id)) {
          selected.value.set(product.id, product)
          added += 1
        }
      }
      return added
    } finally {
      selectingAll.value = false
      progress.value = null
    }
  }

  return { active, selected, selectingAll, progress, count, items, enter, exit, clear, has, toggle, selectAllMatching }
})
