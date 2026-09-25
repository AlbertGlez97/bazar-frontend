import { afterEach, describe, expect, it } from 'vitest'
import {
  addDaysToKey,
  businessDayOf,
  businessToday,
  businessWallClock,
  formatBusinessDate,
  formatBusinessDateTime,
  formatDateKey,
  isValidDateKey,
  isValidRange,
  presetRange,
  validateRange,
} from '../business-time'

// Hora de negocio: UTC-6 fijo todo el año (contrato §1.9). 24 de septiembre de
// 2026 es jueves; el domingo de esa semana es el 20.
const THU_NOON_BUSINESS = new Date('2026-09-24T18:00:00.000Z') // 12:00 en el negocio

describe('businessDayOf / businessToday', () => {
  it('the last millisecond of the business day still belongs to that day', () => {
    expect(businessDayOf('2026-09-25T05:59:59.999Z')).toBe('2026-09-24')
  })

  it('06:00:00.000Z is the first instant of the next business day', () => {
    expect(businessDayOf('2026-09-25T06:00:00.000Z')).toBe('2026-09-25')
  })

  it('crosses month and year boundaries in business time', () => {
    expect(businessDayOf('2026-10-01T05:59:59.999Z')).toBe('2026-09-30')
    expect(businessDayOf('2027-01-01T05:59:59.999Z')).toBe('2026-12-31')
    expect(businessDayOf('2027-01-01T06:00:00.000Z')).toBe('2027-01-01')
  })

  it('accepts Date and epoch milliseconds', () => {
    expect(businessDayOf(new Date('2026-09-25T00:30:00.000Z'))).toBe('2026-09-24')
    expect(businessDayOf(Date.parse('2026-09-25T07:00:00.000Z'))).toBe('2026-09-25')
  })

  it('businessToday uses the business clock, not the UTC one', () => {
    expect(businessToday(new Date('2026-09-25T02:00:00.000Z'))).toBe('2026-09-24')
    expect(businessToday(new Date('2026-09-25T06:00:00.000Z'))).toBe('2026-09-25')
  })
})

describe('the device time zone never matters', () => {
  const original = process.env.TZ
  afterEach(() => {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  })

  it.each(['Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Kiritimati', 'UTC'])('same answers under TZ=%s', (tz) => {
    process.env.TZ = tz
    expect(businessDayOf('2026-09-25T05:59:59.999Z')).toBe('2026-09-24')
    expect(businessDayOf('2026-09-25T06:00:00.000Z')).toBe('2026-09-25')
    expect(businessToday(new Date('2026-09-25T05:59:59.999Z'))).toBe('2026-09-24')
    expect(presetRange('semana', THU_NOON_BUSINESS)).toEqual({ from: '2026-09-20', to: '2026-09-24' })
    expect(formatBusinessDateTime('2026-09-24T20:05:00.000Z')).toBe('24/09/2026 14:05')
  })
})

describe('presetRange', () => {
  it('hoy is the business day of now', () => {
    expect(presetRange('hoy', THU_NOON_BUSINESS)).toEqual({ from: '2026-09-24', to: '2026-09-24' })
  })

  it('hoy just after UTC midnight is still the previous business day', () => {
    expect(presetRange('hoy', new Date('2026-09-25T00:10:00.000Z'))).toEqual({ from: '2026-09-24', to: '2026-09-24' })
  })

  it('ayer is one day before, across a month boundary', () => {
    expect(presetRange('ayer', THU_NOON_BUSINESS)).toEqual({ from: '2026-09-23', to: '2026-09-23' })
    expect(presetRange('ayer', new Date('2026-10-01T12:00:00.000Z'))).toEqual({ from: '2026-09-30', to: '2026-09-30' })
  })

  it('semana runs from the Sunday of the current week to today', () => {
    expect(presetRange('semana', THU_NOON_BUSINESS)).toEqual({ from: '2026-09-20', to: '2026-09-24' })
  })

  it('semana on a Sunday is just that Sunday; on a Saturday it spans seven days', () => {
    expect(presetRange('semana', new Date('2026-09-20T18:00:00.000Z'))).toEqual({ from: '2026-09-20', to: '2026-09-20' })
    expect(presetRange('semana', new Date('2026-09-26T18:00:00.000Z'))).toEqual({ from: '2026-09-20', to: '2026-09-26' })
  })

  it('semana uses business time for the weekday (Sunday 04:00Z is still Saturday there)', () => {
    // 2026-09-27 04:00Z = sábado 26 22:00 en el negocio.
    expect(presetRange('semana', new Date('2026-09-27T04:00:00.000Z'))).toEqual({ from: '2026-09-20', to: '2026-09-26' })
  })

  it('semana can start in the previous month or year', () => {
    expect(presetRange('semana', new Date('2026-10-01T18:00:00.000Z'))).toEqual({ from: '2026-09-27', to: '2026-10-01' })
    expect(presetRange('semana', new Date('2027-01-01T18:00:00.000Z'))).toEqual({ from: '2026-12-27', to: '2027-01-01' })
  })

  it('mes runs from the first of the month to today', () => {
    expect(presetRange('mes', THU_NOON_BUSINESS)).toEqual({ from: '2026-09-01', to: '2026-09-24' })
  })

  it('mes right after UTC midnight of the first is still the previous month in business time', () => {
    expect(presetRange('mes', new Date('2026-10-01T03:00:00.000Z'))).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })
})

describe('addDaysToKey', () => {
  it('moves across months, years and leap days', () => {
    expect(addDaysToKey('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDaysToKey('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysToKey('2027-02-28', 1)).toBe('2027-03-01')
  })
})

describe('isValidDateKey / isValidRange / validateRange', () => {
  it('accepts real calendar days only', () => {
    expect(isValidDateKey('2026-09-24')).toBe(true)
    expect(isValidDateKey('2028-02-29')).toBe(true)
    expect(isValidDateKey('2027-02-29')).toBe(false)
    expect(isValidDateKey('2026-13-01')).toBe(false)
    expect(isValidDateKey('24/09/2026')).toBe(false)
    expect(isValidDateKey('')).toBe(false)
  })

  it('a range is valid when from <= to (same day included)', () => {
    expect(isValidRange('2026-09-24', '2026-09-24')).toBe(true)
    expect(isValidRange('2026-09-01', '2026-09-24')).toBe(true)
    expect(isValidRange('2026-09-25', '2026-09-24')).toBe(false)
    expect(isValidRange('', '2026-09-24')).toBe(false)
    expect(isValidRange('2026-09-24', 'nope')).toBe(false)
  })

  it('validateRange names the problem', () => {
    expect(validateRange('2026-09-01', '2026-09-24', '2026-09-24')).toBeNull()
    expect(validateRange('', '2026-09-24', '2026-09-24')).toBe('incomplete')
    expect(validateRange('2026-09-25', '2026-09-24', '2026-09-24')).toBe('inverted')
    expect(validateRange('2026-09-01', '2026-09-25', '2026-09-24')).toBe('future')
  })
})

describe('formatting in business time', () => {
  it('formats date and time as dd/mm/yyyy hh:mm in UTC-6', () => {
    expect(formatBusinessDateTime('2026-09-24T20:05:00.000Z')).toBe('24/09/2026 14:05')
  })

  it('pads and rolls the day back after midnight UTC', () => {
    expect(formatBusinessDateTime('2026-01-05T03:07:00.000Z')).toBe('04/01/2026 21:07')
    expect(formatBusinessDateTime('2026-09-25T05:59:59.999Z')).toBe('24/09/2026 23:59')
    expect(formatBusinessDateTime('2026-09-25T06:00:00.000Z')).toBe('25/09/2026 00:00')
  })

  it('formatBusinessDate and formatDateKey give dd/mm/yyyy', () => {
    expect(formatBusinessDate('2026-09-25T05:59:59.999Z')).toBe('24/09/2026')
    expect(formatDateKey('2026-09-01')).toBe('01/09/2026')
  })

  it('an unparseable instant renders a dash instead of "NaN"', () => {
    expect(formatBusinessDateTime('not a date')).toBe('—')
    expect(formatBusinessDate('not a date')).toBe('—')
  })

  it('businessWallClock is a Date whose UTC fields are the business wall clock (for Excel)', () => {
    expect(businessWallClock('2026-09-24T20:05:00.000Z').toISOString()).toBe('2026-09-24T14:05:00.000Z')
    expect(businessWallClock('2026-09-25T05:59:59.999Z').toISOString()).toBe('2026-09-24T23:59:59.999Z')
  })
})
