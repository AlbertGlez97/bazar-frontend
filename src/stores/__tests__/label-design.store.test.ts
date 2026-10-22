import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LABEL_DESIGN_STORAGE_KEY, useLabelDesignStore } from '../label-design.store'

/** "Sesión nueva": otro Pinia, la misma localStorage. */
function newSession() {
  setActivePinia(createPinia())
  return useLabelDesignStore()
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('label design store', () => {
  it('starts with "Solo QR" when nothing is saved', () => {
    expect(newSession().design).toBe('qr-only')
    expect(LABEL_DESIGN_STORAGE_KEY).toBe('la-marchanta-label-design')
  })

  it('saves the choice and recovers it in a NEW session', () => {
    newSession().set('qr-detail')
    expect(localStorage.getItem(LABEL_DESIGN_STORAGE_KEY)).toBe('qr-detail')
    expect(newSession().design).toBe('qr-detail')
    const again = newSession()
    again.set('qr-only')
    expect(newSession().design).toBe('qr-only')
  })

  it.each(['', 'otro', '{"x":1}', 'QR-ONLY'])('falls back to "Solo QR" when the saved value is %j', (raw) => {
    localStorage.setItem(LABEL_DESIGN_STORAGE_KEY, raw)
    expect(newSession().design).toBe('qr-only')
  })

  it('ignores an unknown design', () => {
    const store = newSession()
    store.set('qr-detail')
    store.set('nope' as never)
    expect(store.design).toBe('qr-detail')
    expect(localStorage.getItem(LABEL_DESIGN_STORAGE_KEY)).toBe('qr-detail')
  })

  it('still works in memory when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const store = newSession()
    expect(store.design).toBe('qr-only')
    expect(() => store.set('qr-detail')).not.toThrow()
    expect(store.design).toBe('qr-detail')
  })
})
