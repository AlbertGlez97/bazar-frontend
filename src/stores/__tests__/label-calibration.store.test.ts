import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LABEL_CALIBRATION_STORAGE_KEY, useLabelCalibrationStore } from '../label-calibration.store'
import { CALIBRATION_LIMITS, DEFAULT_CALIBRATION } from '@/utils/label-sheet-plan'

/** "Sesión nueva": otro Pinia, la misma localStorage. */
function newSession() {
  setActivePinia(createPinia())
  return useLabelCalibrationStore()
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('label calibration store', () => {
  it('starts with 0 mm, 0 mm and a 24.75 mm row pitch when nothing is saved', () => {
    const store = newSession()
    expect(store.calibration).toEqual({ offsetTopMm: 0, offsetLeftMm: 0, rowPitchMm: 24.75 })
    expect(store.isDefault).toBe(true)
  })

  it('uses a documented storage key', () => {
    expect(LABEL_CALIBRATION_STORAGE_KEY).toBe('la-marchanta-label-calibration')
  })

  it('saves every change to localStorage as JSON', () => {
    const store = newSession()
    store.set({ offsetTopMm: 1.2, offsetLeftMm: -0.5 })
    expect(JSON.parse(localStorage.getItem(LABEL_CALIBRATION_STORAGE_KEY)!)).toEqual({ offsetTopMm: 1.2, offsetLeftMm: -0.5, rowPitchMm: 24.75 })
    expect(store.isDefault).toBe(false)
  })

  it('recovers the saved values in a NEW session', () => {
    newSession().set({ offsetTopMm: 1.2, offsetLeftMm: -0.5, rowPitchMm: 25 })
    const second = newSession()
    expect(second.calibration).toEqual({ offsetTopMm: 1.2, offsetLeftMm: -0.5, rowPitchMm: 25 })
  })

  it('a partial update keeps the other values', () => {
    const store = newSession()
    store.set({ offsetTopMm: 2 })
    store.set({ offsetLeftMm: 3 })
    expect(store.calibration).toEqual({ offsetTopMm: 2, offsetLeftMm: 3, rowPitchMm: 24.75 })
  })

  it('clamps out-of-range values and rounds to 2 decimals', () => {
    const store = newSession()
    store.set({ offsetTopMm: 500, offsetLeftMm: -500, rowPitchMm: 1 })
    expect(store.calibration).toEqual({ offsetTopMm: CALIBRATION_LIMITS.offset.max, offsetLeftMm: CALIBRATION_LIMITS.offset.min, rowPitchMm: CALIBRATION_LIMITS.rowPitch.min })
    store.set({ offsetTopMm: 0.1 + 0.2 })
    expect(store.calibration.offsetTopMm).toBe(0.3)
  })

  it('ignores NaN / empty input: that field goes back to its default', () => {
    const store = newSession()
    store.set({ offsetTopMm: 4 })
    store.set({ offsetTopMm: Number.NaN })
    expect(store.calibration.offsetTopMm).toBe(0)
    store.set({ rowPitchMm: '' as unknown as number })
    expect(store.calibration.rowPitchMm).toBe(24.75)
  })

  it('reset goes back to the defaults and saves them', () => {
    const store = newSession()
    store.set({ offsetTopMm: 4, offsetLeftMm: 4, rowPitchMm: 25 })
    store.reset()
    expect(store.calibration).toEqual(DEFAULT_CALIBRATION)
    expect(store.isDefault).toBe(true)
    expect(newSession().calibration).toEqual(DEFAULT_CALIBRATION)
  })

  it.each([
    ['corrupted JSON', '{not json'],
    ['a number', '42'],
    ['null', 'null'],
    ['an array', '[1,2,3]'],
    ['a string', '"hola"'],
    ['empty text', ''],
  ])('falls back to the defaults when the saved value is %s', (_label, raw) => {
    localStorage.setItem(LABEL_CALIBRATION_STORAGE_KEY, raw)
    expect(newSession().calibration).toEqual(DEFAULT_CALIBRATION)
  })

  it('validates what it reads: bad fields go to default, good ones are kept, out-of-range is clamped', () => {
    localStorage.setItem(LABEL_CALIBRATION_STORAGE_KEY, JSON.stringify({ offsetTopMm: 'x', offsetLeftMm: 99, rowPitchMm: 25 }))
    expect(newSession().calibration).toEqual({ offsetTopMm: 0, offsetLeftMm: CALIBRATION_LIMITS.offset.max, rowPitchMm: 25 })
  })

  it('still works in memory when localStorage is unavailable (private mode, blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const store = newSession()
    expect(store.calibration).toEqual(DEFAULT_CALIBRATION)
    expect(() => store.set({ offsetTopMm: 2 })).not.toThrow()
    expect(store.calibration.offsetTopMm).toBe(2)
    expect(() => store.reset()).not.toThrow()
  })
})
