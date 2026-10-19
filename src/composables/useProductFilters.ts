import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ProductFilterKey, ProductFilters } from '@/types/product-filters.types'
import {
  activeFilterChips,
  clearFilter,
  emptyProductFilters,
  parseProductFilters,
  serializeProductFilters,
} from '@/utils/product-filters'

/** Parámetros de URL que pertenecen a los filtros; el resto de la query no se toca. */
const FILTER_QUERY_KEYS = ['pocaExistencia', 'agotados', 'inactivos', 'tipo', 'sinCosto', 'marca']

/**
 * Filtros del catálogo de Productos con la URL como fuente de verdad: así se
 * conservan al recargar, se pueden compartir y la tarjeta "Poca existencia" de
 * Inicio solo tiene que navegar a `?pocaExistencia=1`. Cambiarlos usa `replace`
 * (no llena el historial con un paso por interruptor).
 *
 * Sin router instalado (varias pruebas montan la vista sola) cae a un estado
 * en memoria con la misma interfaz.
 */
export function useProductFilters(options: { allowInactive: MaybeRefOrGetter<boolean> }) {
  // `useRoute()`/`useRouter()` sin router instalado dan `undefined`: nunca se asumen presentes.
  const route = useRoute() as ReturnType<typeof useRoute> | undefined
  const router = useRouter() as ReturnType<typeof useRouter> | undefined
  const local = ref<ProductFilters>(emptyProductFilters())
  // Lo último que se pidió mientras `router.replace` todavía no termina: la
  // interfaz lo muestra de inmediato y un segundo cambio seguido parte de ahí
  // en vez de pisar al primero con la URL vieja.
  const pending = ref<ProductFilters>()

  const filters = computed<ProductFilters>(() => {
    const allowInactive = toValue(options.allowInactive)
    const source = pending.value
      ?? (route ? parseProductFilters(route.query, { allowInactive }) : local.value)
    return { ...source, inactivos: source.inactivos && allowInactive }
  })

  /** Cambia solo cuando cambian los filtros (no por otros parámetros de la URL): sirve para vigilarlos. */
  const filtersKey = computed(() => JSON.stringify(serializeProductFilters(filters.value)))
  const chips = computed(() => activeFilterChips(filters.value))
  const activeCount = computed(() => chips.value.length)

  let requestId = 0

  async function setFilters(next: ProductFilters) {
    if (!route || !router) {
      local.value = { ...next }
      return
    }
    const mine = ++requestId
    pending.value = { ...next }
    const query = Object.fromEntries(
      Object.entries(route.query).filter(([key]) => !FILTER_QUERY_KEYS.includes(key)),
    )
    try {
      await router.replace({ query: { ...query, ...serializeProductFilters(next) } })
    } finally {
      // Solo el último cambio suelta el estado pendiente; si falló, la URL manda.
      if (mine === requestId) pending.value = undefined
    }
  }

  const removeFilter = (key: ProductFilterKey) => setFilters(clearFilter(filters.value, key))
  const clearFilters = () => setFilters(emptyProductFilters())

  return { filters, filtersKey, chips, activeCount, setFilters, removeFilter, clearFilters }
}
