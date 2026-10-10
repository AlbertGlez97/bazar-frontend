import { onScopeDispose, ref } from 'vue'
import type { Ref } from 'vue'

/**
 * Reactive `window.matchMedia`. Where `matchMedia` does not exist (older test
 * environments) the ref keeps `fallback`, so layout code always has an answer.
 */
export function useMediaQuery(query: string, fallback = false): Ref<boolean> {
  const matches = ref(fallback)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return matches

  const list = window.matchMedia(query)
  matches.value = list.matches
  const onChange = (event: MediaQueryListEvent) => { matches.value = event.matches }
  if (typeof list.addEventListener === 'function') {
    list.addEventListener('change', onChange)
    onScopeDispose(() => list.removeEventListener('change', onChange))
  } else if (typeof list.addListener === 'function') {
    list.addListener(onChange)
    onScopeDispose(() => list.removeListener(onChange))
  }
  return matches
}
