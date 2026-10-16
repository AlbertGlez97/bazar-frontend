import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDismissedHint } from '../useDismissedHint'

const KEY = 'la-marchanta-hint-test'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('useDismissedHint (pista que se recuerda por dispositivo)', () => {
  it('sin nada guardado la pista no está descartada', () => {
    expect(useDismissedHint(KEY).dismissed.value).toBe(false)
  })

  it('descartarla la apaga y la guarda en localStorage del dispositivo', () => {
    const hint = useDismissedHint(KEY)

    hint.dismiss()

    expect(hint.dismissed.value).toBe(true)
    expect(localStorage.getItem(KEY)).toBe('1')
  })

  it('al "recargar" (otro uso del composable) sigue descartada', () => {
    useDismissedHint(KEY).dismiss()

    expect(useDismissedHint(KEY).dismissed.value).toBe(true)
  })

  it('cada pista tiene su propia clave', () => {
    useDismissedHint(KEY).dismiss()

    expect(useDismissedHint('otra-clave').dismissed.value).toBe(false)
  })

  it('descartar dos veces no falla ni cambia nada', () => {
    const hint = useDismissedHint(KEY)
    hint.dismiss()
    hint.dismiss()

    expect(hint.dismissed.value).toBe(true)
  })

  it('si leer localStorage lanza (modo privado, sitio bloqueado) la pista simplemente se muestra', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })

    expect(() => useDismissedHint(KEY)).not.toThrow()
    expect(useDismissedHint(KEY).dismissed.value).toBe(false)
  })

  it('si guardar lanza, se descarta igual en esta carga y no falla', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    const hint = useDismissedHint(KEY)

    expect(() => hint.dismiss()).not.toThrow()
    expect(hint.dismissed.value).toBe(true)
  })
})
