import { describe, expect, it } from 'vitest'
import {
  FinanceReserveContractError,
  ReserveFormError,
  cancelReasonFromText,
  emptyReserveForm,
  formatPickedPeriod,
  formatReservePeriod,
  isConflict,
  isUncertainFailure,
  matchesRange,
  plannedTotalForRange,
  reserveErrorMessage,
  isMissingRoute,
  reserveExclusiveTo,
  reserveFieldsFromForm,
  reservePickerPeriod,
  splitByPeriod,
} from '../finance-reserves'
import { CANCEL_ID, cancellationFixture, reserveItemFixture } from '@/services/__tests__/finance-reserves.fixture'

const range = { from: '2026-10-01', to: '2026-10-31' }
const form = (over = {}) => ({ ...emptyReserveForm(), name: 'Renta', amount: '1,500.00', ...over })
const failure = (status?: number) => Object.assign(new Error('x'), status ? { response: { status } } : {})

describe('reserve period', () => {
  it('sends the day after the picked end and shows the stored period with an inclusive end', () => {
    expect(reserveExclusiveTo('2026-10-31')).toBe('2026-11-01')
    expect(reservePickerPeriod('2026-10-01', '2026-11-01')).toEqual(range)
    expect(formatReservePeriod('2026-10-01', '2026-11-01')).toBe('01/10/2026 al 31/10/2026')
    expect(formatPickedPeriod(range)).toBe('01/10/2026 al 31/10/2026')
  })

  it('shows a single date for a one-day period and crosses month and year ends', () => {
    expect(formatReservePeriod('2026-10-07', '2026-10-08')).toBe('07/10/2026')
    expect(formatReservePeriod('2026-12-01', '2027-01-01')).toBe('01/12/2026 al 31/12/2026')
  })

  it('matches only an EXACT period, never an overlap', () => {
    expect(matchesRange(reserveItemFixture(), range)).toBe(true)
    expect(matchesRange(reserveItemFixture({ periodTo: '2026-10-15' }), range)).toBe(false)
    expect(matchesRange(reserveItemFixture({ periodFrom: '2026-09-15' }), range)).toBe(false)
    expect(matchesRange(reserveItemFixture(), { from: '2026-10-01', to: '' })).toBe(false)
  })
})

describe('reserve form validation', () => {
  it('builds the API fields: trimmed name, cents, exclusive period and null note', () => {
    expect(reserveFieldsFromForm(form({ name: '  Renta  ' }), range)).toEqual({
      name: 'Renta',
      amountMinor: 150000,
      periodFrom: '2026-10-01',
      periodTo: '2026-11-01',
      note: null,
    })
    expect(reserveFieldsFromForm(form({ note: ' algo ' }), range).note).toBe('algo')
  })

  it.each([
    ['empty name', { name: '   ' }],
    ['too long name', { name: 'a'.repeat(121) }],
    ['empty amount', { amount: '' }],
    ['zero amount', { amount: '0.00' }],
    ['ambiguous amount', { amount: '100,50' }],
    ['amount over the cap', { amount: '21474836.48' }],
    ['too long note', { note: 'n'.repeat(1001) }],
  ])('rejects %s', (_name, over) => {
    expect(() => reserveFieldsFromForm(form(over), range)).toThrow(ReserveFormError)
  })

  it('accepts the maximum amount, 120-char name and 1000-char note', () => {
    const fields = reserveFieldsFromForm(form({ name: 'a'.repeat(120), amount: '21474836.47', note: 'n'.repeat(1000) }), range)
    expect(fields.amountMinor).toBe(2147483647)
  })

  it('rejects an invalid or inverted period', () => {
    expect(() => reserveFieldsFromForm(form(), { from: '2026-10-31', to: '2026-10-01' })).toThrow(ReserveFormError)
    expect(() => reserveFieldsFromForm(form(), { from: '', to: '2026-10-01' })).toThrow(ReserveFormError)
  })

  it('requires a trimmed cancellation reason of at most 1000 characters', () => {
    expect(cancelReasonFromText('  ya no  ')).toBe('ya no')
    expect(() => cancelReasonFromText('  ')).toThrow(ReserveFormError)
    expect(() => cancelReasonFromText('x'.repeat(1001))).toThrow(ReserveFormError)
  })
})

describe('reserve totals', () => {
  const other = reserveItemFixture({ id: CANCEL_ID, periodFrom: '2026-09-01', periodTo: '2026-10-01', amountMinor: 90000 })
  const cancelled = reserveItemFixture({
    id: '0199a600-0000-7000-8000-000000000003',
    status: 'reversed',
    reversal: cancellationFixture({ reserveId: '0199a600-0000-7000-8000-000000000003' }),
  })

  it('separates reserves of the selected period from those of other periods', () => {
    const { matching, other: elsewhere } = splitByPeriod([reserveItemFixture(), other], range)
    expect(matching).toHaveLength(1)
    expect(elsewhere).toEqual([other])
  })

  it('totals only ACTIVE reserves of the exact period and never adds other periods', () => {
    expect(plannedTotalForRange([reserveItemFixture(), reserveItemFixture({ amountMinor: 250 }), other, cancelled], range)).toBe(500250)
    expect(plannedTotalForRange([other], range)).toBe(0)
    expect(plannedTotalForRange([], range)).toBe(0)
  })
})

describe('reserve error messages: missing server route', () => {
  it('explains a 404 on list and create as an unavailable function, never as a missing reserve', () => {
    for (const action of ['list', 'create'] as const) {
      const message = reserveErrorMessage(failure(404), action)
      expect(message).toContain('Esta función aún no está disponible en el servidor')
      expect(message).not.toMatch(/ya no existe|Algo salió mal/)
    }
    expect(isMissingRoute(failure(404))).toBe(true)
    expect(isMissingRoute(failure(500))).toBe(false)
    expect(isMissingRoute(failure())).toBe(false)
  })

  it('keeps other list/create failures unchanged', () => {
    expect(reserveErrorMessage(failure(500), 'list')).toMatch(/Algo salió mal/)
    expect(reserveErrorMessage(failure(), 'list')).toMatch(/conectarnos/)
    expect(reserveErrorMessage(new FinanceReserveContractError(), 'list')).toContain('formato inesperado')
  })
})

describe('reserve error messages', () => {
  it('never claims the reserve was saved when offline and reassures about duplicates', () => {
    expect(reserveErrorMessage(failure(), 'create')).toBe(
      'No pudimos guardar la reserva. Revisa tu conexión; si reintentas no se duplicará.',
    )
    expect(reserveErrorMessage(failure(), 'cancel')).toContain('no se anulará dos veces')
  })

  it('maps conflicts, validation and permissions to calm copy', () => {
    expect(reserveErrorMessage(failure(409), 'create')).toContain('Revisa la lista')
    expect(reserveErrorMessage(failure(409), 'cancel')).toContain('ya estaba anulada')
    expect(reserveErrorMessage(failure(400), 'create')).toContain('Revísalos')
    expect(reserveErrorMessage(failure(403), 'create')).toContain('personas socias')
    expect(reserveErrorMessage(failure(404), 'cancel')).toContain('ya no existe')
    expect(reserveErrorMessage(failure(404), 'cancel')).not.toContain('Esta función aún no está disponible en el servidor')
    expect(reserveErrorMessage(failure(500), 'list')).not.toMatch(/\d{3}|stack/i)
    expect(reserveErrorMessage(new FinanceReserveContractError(), 'create')).toContain('Actualiza la lista')
  })

  it('treats network, timeout, 5xx and unreadable answers as uncertain and 4xx as definitive', () => {
    for (const e of [failure(), failure(500), failure(503), failure(408), failure(429), new FinanceReserveContractError()])
      expect(isUncertainFailure(e)).toBe(true)
    for (const e of [failure(400), failure(403), failure(404), failure(409)]) expect(isUncertainFailure(e)).toBe(false)
    expect(isConflict(failure(409))).toBe(true)
    expect(isConflict(failure(400))).toBe(false)
  })
})
