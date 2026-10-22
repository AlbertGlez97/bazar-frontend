import { computed, ref } from 'vue'
import { VOICE, isNetworkError } from '@/config/voice'
import ProductsService from '@/services/products.service'
import { useCatalogExportStore } from '@/stores/catalog-export.store'
import type { CatalogSource } from '@/types/catalog.types'
import { buildCatalogData, listCatalogCategories, toCatalogSource } from '@/utils/catalog-data'
import { toDataOptions, toDocOptions } from '@/utils/catalog-export-settings'
import { fetchAllProductPages } from '@/utils/fetch-all-pages'
import { saveBlob } from '@/utils/report-files'

export type CatalogPhase = 'idle' | 'loading' | 'photos' | 'document'

/**
 * Catálogo en Word desde Gestión > Productos. Baja TODOS los productos activos (de a 100),
 * se queda SOLO con la lista blanca de campos (`toCatalogSource`: el costo, el proveedor y
 * las notas no pasan de aquí), arma el resumen con las opciones elegidas y, al generar, reduce
 * las fotos y escribe el .docx. Los módulos pesados (canvas y `docx`) se cargan al generar.
 */
export function useCatalogExport() {
  const store = useCatalogExportStore()
  const sources = ref<CatalogSource[]>([])
  const loaded = ref(false)
  const phase = ref<CatalogPhase>('idle')
  const progress = ref({ done: 0, total: 0 })
  const error = ref('')
  let controller: AbortController | null = null

  const busy = computed(() => phase.value !== 'idle')
  const data = computed(() => buildCatalogData(sources.value, toDataOptions(store.settings)))
  const categories = computed(() => listCatalogCategories(sources.value))
  /** Para la selección manual: id y nombre legible. */
  const candidates = computed(() =>
    sources.value
      .map((source) => ({ id: source.id, name: source.name, detail: [source.brand, source.presentation].filter(Boolean).join(' · ') }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es-MX', { sensitivity: 'base', numeric: true })),
  )

  /** Baja los productos (necesita internet). Se puede repetir para refrescar. */
  async function load(): Promise<void> {
    if (busy.value) return
    phase.value = 'loading'
    error.value = ''
    try {
      const products = await fetchAllProductPages((page, limit) => ProductsService.listProducts({ page, limit }))
      sources.value = products.map(toCatalogSource)
      loaded.value = true
    } catch (cause) {
      // Sin respuesta del servidor es un problema de internet; una respuesta con error, no.
      error.value = isNetworkError(cause) ? VOICE.networkError : VOICE.catalogExport.error
    } finally {
      phase.value = 'idle'
    }
  }

  function cancel(): void {
    controller?.abort()
  }

  /** Reduce las fotos, arma el Word y lo descarga. Devuelve `true` si se descargó. */
  async function generate(): Promise<boolean> {
    if (busy.value || data.value.productCount === 0) return false
    const settings = store.settings
    controller = new AbortController()
    error.value = ''
    progress.value = { done: 0, total: 0 }
    try {
      const current = data.value
      const images = await (async () => {
        if (!settings.fields.photo) return { photos: new Map(), placeholder: null }
        phase.value = 'photos'
        const { processCatalogImages, makePlaceholder, PHOTO_QUALITY } = await import('@/services/catalog-images')
        const maxSide = PHOTO_QUALITY[settings.photoQuality]
        const urls = current.categories.flatMap((category) => category.entries.map((entry) => entry.image)).filter((url): url is string => !!url)
        progress.value = { done: 0, total: new Set(urls).size }
        const photos = await processCatalogImages(urls, {
          maxSide,
          signal: controller!.signal,
          onProgress: (done, total) => { progress.value = { done, total } },
        })
        // El marcador "Sin foto" sirve a los productos sin foto y a los que fallaron.
        const placeholder = await makePlaceholder(maxSide)
        return { photos, placeholder }
      })()

      phase.value = 'document'
      const { generateCatalogDocx, catalogFileName } = await import('@/services/catalog-docx')
      const date = new Date()
      const options = toDocOptions(settings, date)
      const document = await generateCatalogDocx(current, images.photos, images.placeholder, options)
      saveBlob(document.blob, catalogFileName(options.businessName, date))
      return true
    } catch (cause) {
      // Cancelar no es un error: se vuelve al diálogo sin mensaje.
      // Las fotos que fallan ya llevan marcador: lo que llega aquí es un fallo del armado, no de internet.
      if (!(controller?.signal.aborted && isAbort(cause))) error.value = VOICE.catalogExport.error
      return false
    } finally {
      phase.value = 'idle'
      controller = null
    }
  }

  return { sources, loaded, phase, busy, progress, error, data, categories, candidates, load, generate, cancel }
}

function isAbort(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && (cause as { name?: string }).name === 'AbortError'
}
