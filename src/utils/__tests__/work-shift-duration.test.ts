import { describe, expect, it } from 'vitest'
import {
  MAX_WORK_SHIFT_MINUTES,
  NO_DURATION_LABEL,
  WorkShiftFormError,
  formatDuration,
  formatRegisteredMinutes,
  minutesFromDuration,
} from '../work-shift-duration'

describe('minutesFromDuration', () => {
  it('treats both empty fields (or blanks) as an unknown duration: null, never 0', () => {
    expect(minutesFromDuration('', '')).toBeNull()
    expect(minutesFromDuration('  ', ' ')).toBeNull()
    expect(minutesFromDuration('', '')).not.toBe(0)
  })

  it.each([
    ['8', '', 480],
    ['8', '30', 510],
    ['', '45', 45],
    ['0', '1', 1],
    ['1', '0', 60],
    ['0', '59', 59],
    ['08', '05', 485],
    [' 2 ', ' 15 ', 135],
    ['24', '0', 1440],
  ])('converts %s h %s min to %i minutes with integers only', (h, m, expected) => {
    expect(minutesFromDuration(h, m)).toBe(expected)
  })

  it.each([
    ['1.5', ''],
    ['', '30.5'],
    ['1,5', ''],
    ['-1', ''],
    ['', '-5'],
    ['+2', ''],
    ['abc', ''],
    ['NaN', ''],
    ['1e2', ''],
    ['Infinity', ''],
    ['', '０'],
    ['1 2', ''],
  ])('rejects the non-integer input %j / %j', (h, m) => {
    expect(() => minutesFromDuration(h, m)).toThrow(WorkShiftFormError)
  })

  it('requires the minutes field to be 0-59', () => {
    expect(() => minutesFromDuration('', '60')).toThrow('0 a 59')
    expect(() => minutesFromDuration('1', '90')).toThrow('0 a 59')
    expect(minutesFromDuration('1', '59')).toBe(119)
  })

  it('requires at least one minute when anything is provided', () => {
    for (const [h, m] of [['0', '0'], ['0', ''], ['', '0']])
      expect(() => minutesFromDuration(h!, m!)).toThrow('al menos 1 minuto')
  })

  it('stays within the backend integer limit', () => {
    const maxHours = Math.floor(MAX_WORK_SHIFT_MINUTES / 60)
    const maxRest = MAX_WORK_SHIFT_MINUTES - maxHours * 60
    expect(minutesFromDuration(String(maxHours), String(maxRest))).toBe(MAX_WORK_SHIFT_MINUTES)
    expect(() => minutesFromDuration(String(maxHours), String(maxRest + 1))).toThrow('demasiado grande')
    expect(() => minutesFromDuration(String(maxHours + 1), '')).toThrow('demasiado grande')
    expect(() => minutesFromDuration('99999999999', '')).toThrow('demasiado grande')
  })

  it('names the offending field in the message', () => {
    expect(() => minutesFromDuration('x', '')).toThrow('Las horas deben ser números enteros')
    expect(() => minutesFromDuration('', '-5')).toThrow('Los minutos deben ser números enteros')
    expect(() => minutesFromDuration('x', '')).toThrow('horas')
    expect(() => minutesFromDuration('', 'x')).toThrow('minutos')
  })
})

describe('formatDuration', () => {
  it.each([
    [480, '8 h'],
    [510, '8 h 30 min'],
    [45, '45 min'],
    [1, '1 min'],
    [60, '1 h'],
    [61, '1 h 1 min'],
  ])('formats %i minutes as %s', (minutes, text) => {
    expect(formatDuration(minutes)).toBe(text)
  })

  it('shows an unknown duration as text, never as 0', () => {
    expect(formatDuration(null)).toBe('Duración no registrada')
    expect(formatDuration(undefined)).toBe(NO_DURATION_LABEL)
    expect(formatDuration(0)).toBe(NO_DURATION_LABEL)
    expect(formatDuration(1.5)).toBe(NO_DURATION_LABEL)
    expect(formatDuration(Number.NaN)).toBe(NO_DURATION_LABEL)
  })

  it('formats a recorded subtotal, where zero means no known durations', () => {
    expect(formatRegisteredMinutes(0)).toBe('0 h')
    expect(formatRegisteredMinutes(150)).toBe('2 h 30 min')
  })
})
