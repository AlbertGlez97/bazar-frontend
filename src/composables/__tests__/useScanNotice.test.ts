import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const { vibrate } = vi.hoisted(() => ({ vibrate: vi.fn(() => true) }))
vi.mock('../useHaptics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../useHaptics')>()),
  useHaptics: () => ({ vibrate, supported: () => true }),
}))

import { HAPTIC_ERROR, HAPTIC_OK } from '../useHaptics'
import { useScanNotice, SCAN_NOTICE_MS } from '../useScanNotice'

beforeEach(() => {
  vi.useFakeTimers()
  vibrate.mockClear()
})
afterEach(() => vi.useRealTimers())

function make() {
  const scope = effectScope()
  const notice = scope.run(() => useScanNotice())!
  return { notice, scope }
}

describe('useScanNotice', () => {
  it('un producto agregado muestra "Agregado ✓" con su nombre y vibra una vez', () => {
    const { notice } = make()

    notice.added('Vaso azul', 1)

    expect(notice.current.value).toMatchObject({ kind: 'success', title: 'Agregado ✓', detail: 'Vaso azul' })
    expect(vibrate).toHaveBeenCalledTimes(1)
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_OK)
  })

  it('el mismo producto otra vez ACTUALIZA el aviso con el conteo, no se apilan', () => {
    const { notice } = make()

    notice.added('Vaso azul', 1)
    notice.added('Vaso azul', 2)

    expect(notice.current.value?.detail).toBe('Vaso azul ×2')
    expect(vibrate).toHaveBeenCalledTimes(2)
  })

  it('el aviso dura ~1.5 s y se quita solo', () => {
    const { notice } = make()
    notice.added('Vaso azul', 1)

    vi.advanceTimersByTime(SCAN_NOTICE_MS - 1)
    expect(notice.current.value).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(notice.current.value).toBeNull()
    expect(SCAN_NOTICE_MS).toBe(1500)
  })

  it('actualizar el aviso reinicia el tiempo', () => {
    const { notice } = make()
    notice.added('Vaso azul', 1)
    vi.advanceTimersByTime(1000)

    notice.added('Vaso azul', 2)
    vi.advanceTimersByTime(1000)

    expect(notice.current.value?.detail).toBe('Vaso azul ×2')
  })

  it('un código que no existe muestra el aviso rojo y vibra dos pulsos', () => {
    const { notice } = make()

    notice.unknown()

    expect(notice.current.value).toMatchObject({ kind: 'error', title: 'No encontré este producto' })
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_ERROR)
  })

  it('un rechazo del carrito (agotado, pieza única) también es rojo, con su explicación', () => {
    const { notice } = make()

    notice.rejected('Jarrito está agotado.')

    expect(notice.current.value).toMatchObject({ kind: 'error', title: 'Jarrito está agotado.' })
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_ERROR)
  })

  it('un aviso rojo reemplaza al verde (siempre uno solo)', () => {
    const { notice } = make()
    notice.added('Vaso azul', 1)

    notice.unknown()

    expect(notice.current.value?.kind).toBe('error')
  })

  it('al destruir el alcance no queda un temporizador vivo', () => {
    const { notice, scope } = make()
    notice.added('Vaso azul', 1)

    scope.stop()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('no suena: no toca Audio ni AudioContext', () => {
    const audio = vi.fn()
    vi.stubGlobal('Audio', audio)
    vi.stubGlobal('AudioContext', audio)
    const { notice } = make()

    notice.added('Vaso azul', 1)
    notice.unknown()

    expect(audio).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
