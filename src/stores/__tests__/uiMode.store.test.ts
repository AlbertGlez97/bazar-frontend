import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mockDevice, type MockDevice } from '@/test/mockDevice'
import { UI_MODE_STORAGE_KEY, useUiModeStore } from '../uiMode.store'

let device: MockDevice | null = null

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  device?.restore()
  device = null
  vi.restoreAllMocks()
})

/** Crea un store nuevo: la inicialización ocurre al crearlo. */
function freshStore() {
  setActivePinia(createPinia())
  return useUiModeStore()
}

describe('uiMode.store — primera vez (sin preferencia guardada)', () => {
  it('sugiere "venta" en un dispositivo táctil de pantalla pequeña', () => {
    device = mockDevice({ touch: true, small: true })
    expect(freshStore().currentMode).toBe('venta')
  })

  it('sugiere "gestion" en un equipo grande sin pantalla táctil', () => {
    device = mockDevice({ touch: false, small: false })
    expect(freshStore().currentMode).toBe('gestion')
  })

  it.each([
    { touch: true, small: false },
    { touch: false, small: true },
  ])('sugiere "gestion" cuando solo se cumple una señal (%o)', (signals) => {
    device = mockDevice(signals)
    expect(freshStore().currentMode).toBe('gestion')
  })

  it('sin matchMedia (entorno sin soporte) cae en "gestion"', () => {
    expect(freshStore().currentMode).toBe('gestion')
  })

  it('guarda la sugerencia de inmediato', () => {
    device = mockDevice({ touch: true, small: true })
    freshStore()
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('venta')
  })
})

describe('uiMode.store — preferencia guardada', () => {
  it('respeta la preferencia guardada aunque el dispositivo sugiera otra cosa', () => {
    device = mockDevice({ touch: true, small: true }) // sugeriría "venta"
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'gestion')
    expect(freshStore().currentMode).toBe('gestion')
  })

  it('no sobrescribe la preferencia guardada al iniciar', () => {
    device = mockDevice({ touch: true, small: true })
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'gestion')
    setItem.mockClear()

    freshStore()

    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('gestion')
  })

  it('un valor inválido se trata como ausente: usa la sugerencia y la guarda', () => {
    device = mockDevice({ touch: true, small: true })
    localStorage.setItem(UI_MODE_STORAGE_KEY, 'cualquier-cosa')
    expect(freshStore().currentMode).toBe('venta')
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('venta')
  })
})

describe('uiMode.store — cambio de modo', () => {
  it('setMode cambia el modo y lo guarda', () => {
    const store = freshStore()
    expect(store.currentMode).toBe('gestion')

    store.setMode('venta')

    expect(store.currentMode).toBe('venta')
    expect(store.isVenta).toBe(true)
    expect(localStorage.getItem(UI_MODE_STORAGE_KEY)).toBe('venta')
  })

  it('la preferencia elegida sobrevive a recrear el store (recarga)', () => {
    freshStore().setMode('venta')
    expect(freshStore().currentMode).toBe('venta')
  })
})

describe('uiMode.store — localStorage que falla', () => {
  it('si leer lanza, sigue funcionando con la sugerencia', () => {
    device = mockDevice({ touch: true, small: true })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    expect(freshStore().currentMode).toBe('venta')
  })

  it('si guardar lanza, el cambio de modo sigue valiendo en memoria', () => {
    const store = freshStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cuota') })
    expect(() => store.setMode('venta')).not.toThrow()
    expect(store.currentMode).toBe('venta')
  })
})
