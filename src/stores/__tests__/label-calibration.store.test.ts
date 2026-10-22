import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { LABEL_CALIBRATION_STORAGE_KEY, useLabelCalibrationStore } from '../label-calibration.store'
import { CALIBRATION_LIMITS, DEFAULT_CALIBRATION } from '@/utils/label-sheet-plan'

/** "Sesión nueva": otro Pinia, la misma localStorage. */
function newSession() {
  setActivePinia(createPinia())
  return useLabelCalibrationStore()
}

const CALIBRATED = { marginTopMm: 10.2, marginLeftMm: 6.1, labelWidthMm: 66.2, labelHeightMm: 25.1, gapXMm: 3.6, pitchYMm: 25.6 }

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('label calibration store', () => {
  it('starts with the typical Avery 5160 defaults when nothing is saved', () => {
    const store = newSession()
    expect(store.calibration).toEqual({ marginTopMm: 12.7, marginLeftMm: 4.8, labelWidthMm: 66.7, labelHeightMm: 25.4, gapXMm: 3.2, pitchYMm: 25.4 })
    expect(store.isDefault).toBe(true)
  })

  it('uses a documented storage key', () => {
    expect(LABEL_CALIBRATION_STORAGE_KEY).toBe('la-marchanta-label-calibration')
  })

  it('saves every change to localStorage as JSON', () => {
    const store = newSession()
    store.set({ marginTopMm: 11.2, marginLeftMm: 5.5 })
    expect(JSON.parse(localStorage.getItem(LABEL_CALIBRATION_STORAGE_KEY)!)).toEqual({ ...DEFAULT_CALIBRATION, marginTopMm: 11.2, marginLeftMm: 5.5 })
    expect(store.isDefault).toBe(false)
  })

  it('recovers all six saved values in a NEW session', () => {
    newSession().set(CALIBRATED)
    expect(newSession().calibration).toEqual(CALIBRATED)
  })

  it('a partial update keeps the other values', () => {
    const store = newSession()
    store.set({ marginTopMm: 2 })
    store.set({ gapXMm: 3 })
    expect(store.calibration).toEqual({ ...DEFAULT_CALIBRATION, marginTopMm: 2, gapXMm: 3 })
  })

  it('clamps out-of-range values and rounds to 2 decimals', () => {
    const store = newSession()
    store.set({ marginTopMm: 500, marginLeftMm: -500, pitchYMm: 1 })
    expect(store.calibration).toMatchObject({
      marginTopMm: CALIBRATION_LIMITS.marginTopMm.max,
      marginLeftMm: CALIBRATION_LIMITS.marginLeftMm.min,
      pitchYMm: CALIBRATION_LIMITS.pitchYMm.min,
    })
    store.set({ marginTopMm: 0.1 + 0.2 })
    expect(store.calibration.marginTopMm).toBe(0.3)
  })

  it('ignores NaN / empty input: that field goes back to its default', () => {
    const store = newSession()
    store.set({ marginTopMm: 4 })
    store.set({ marginTopMm: Number.NaN })
    expect(store.calibration.marginTopMm).toBe(DEFAULT_CALIBRATION.marginTopMm)
    store.set({ pitchYMm: '' as unknown as number })
    expect(store.calibration.pitchYMm).toBe(DEFAULT_CALIBRATION.pitchYMm)
  })

  it('"Restaurar valores por defecto" goes back to the defaults and saves them', () => {
    const store = newSession()
    store.set(CALIBRATED)
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
    ['the old A4 shape', '{"offsetTopMm":3,"offsetLeftMm":2,"rowPitchMm":25}'],
  ])('falls back to the defaults when the saved value is %s', (_label, raw) => {
    localStorage.setItem(LABEL_CALIBRATION_STORAGE_KEY, raw)
    expect(newSession().calibration).toEqual(DEFAULT_CALIBRATION)
  })

  it('validates what it reads: bad fields go to default, good ones are kept, out-of-range is clamped', () => {
    localStorage.setItem(LABEL_CALIBRATION_STORAGE_KEY, JSON.stringify({ marginTopMm: 'x', marginLeftMm: 99, labelWidthMm: 66 }))
    expect(newSession().calibration).toEqual({
      ...DEFAULT_CALIBRATION,
      marginLeftMm: CALIBRATION_LIMITS.marginLeftMm.max,
      labelWidthMm: 66,
    })
  })

  it('still works in memory when localStorage is unavailable (private mode, blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const store = newSession()
    expect(store.calibration).toEqual(DEFAULT_CALIBRATION)
    expect(() => store.set({ marginTopMm: 2 })).not.toThrow()
    expect(store.calibration.marginTopMm).toBe(2)
    expect(() => store.reset()).not.toThrow()
  })
})
