import { computed, onScopeDispose, ref } from 'vue'

/** Cuenta regresiva en segundos (para "Reenviar correo" en N s). Se limpia sola al destruir el alcance. */
export function useCountdown() {
  const remaining = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (timer !== null) clearInterval(timer)
    timer = null
  }

  function start(seconds: number) {
    stop()
    remaining.value = Math.max(0, Math.floor(seconds))
    if (remaining.value === 0) return
    timer = setInterval(() => {
      remaining.value -= 1
      if (remaining.value <= 0) {
        remaining.value = 0
        stop()
      }
    }, 1000)
  }

  onScopeDispose(stop)

  return { remaining, running: computed(() => remaining.value > 0), start }
}
