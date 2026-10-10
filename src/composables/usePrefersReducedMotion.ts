import { computed } from 'vue'
import { useMediaQuery } from '@/composables/useMediaQuery'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Tracks the user's reduced-motion preference. CSS handles transitions on its
 * own (see `main.css`); this is for the places where JavaScript picks a
 * behavior, such as `scrollIntoView`.
 */
export function usePrefersReducedMotion() {
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY, false)
  /** `'auto'` (instant) when the user asked for less motion, `'smooth'` otherwise. */
  const scrollBehavior = computed<ScrollBehavior>(() => (prefersReducedMotion.value ? 'auto' : 'smooth'))
  return { prefersReducedMotion, scrollBehavior }
}
