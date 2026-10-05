import { describe, expect, it } from 'vitest'
import {
  ExpenseFormError,
  emptyExpenseForm,
  expenseFieldsFromForm,
  formFromExpense,
  withNature,
  type ExpenseFormState,
} from '../expense-form'
import {
  CATEGORY_LABELS,
  OPERATING_CATEGORIES,
  categoryMatchesNature,
} from '../expense-catalog'

const payers = [{ id: 'ana' }]
const valid = (over: Partial<ExpenseFormState> = {}): ExpenseFormState => ({
  ...emptyExpenseForm('2026-10-03'),
  category: 'transport',
  amount: '1,450.50',
  paidByMemberId: 'ana',
  fundsSource: 'BUSINESS',
  description: ' Flete ',
  ...over,
})

describe('expense catalog', () => {
  it('has the 11 operating categories plus Inventario, with Spanish labels', () => {
    expect(OPERATING_CATEGORIES).toHaveLength(11)
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(12)
    expect(CATEGORY_LABELS.inventory).toBe('Inventario')
    expect(CATEGORY_LABELS.bazaar_rent).toBe('Bazar / renta')
  })
  it('keeps nature and category consistent', () => {
    expect(categoryMatchesNature('INVENTORY_PURCHASE', 'inventory')).toBe(true)
    expect(categoryMatchesNature('INVENTORY_PURCHASE', 'fuel')).toBe(false)
    expect(categoryMatchesNature('OPERATING_EXPENSE', 'inventory')).toBe(false)
    expect(categoryMatchesNature('OPERATING_EXPENSE', 'fuel')).toBe(true)
  })
})

describe('expense form conversion', () => {
  it('converts to integer minor units at business-day midnight with a trimmed description', () => {
    expect(expenseFieldsFromForm(valid(), payers)).toEqual({
      amountMinor: 145050,
      occurredAt: '2026-10-03T00:00:00-06:00',
      nature: 'OPERATING_EXPENSE',
      category: 'transport',
      description: 'Flete',
      paidByMemberId: 'ana',
      fundsSource: 'BUSINESS',
    })
  })

  it('never produces float cents for tricky amounts', () => {
    for (const [text, minor] of [
      ['0.07', 7],
      ['19.99', 1999],
      ['1.15', 115],
      ['8.2', 820],
      ['21474836.47', 2147483647],
    ] as const)
      expect(expenseFieldsFromForm(valid({ amount: text }), payers).amountMinor).toBe(minor)
  })

  it.each(['', '0', '0.00', '10.005', '100,50', '-5', '1e3', 'abc', '21474836.48'])(
    'rejects the amount %j',
    (amount) => {
      expect(() => expenseFieldsFromForm(valid({ amount }), payers)).toThrow(ExpenseFormError)
    },
  )

  it('forces Inventario for an inventory purchase whatever category was typed before', () => {
    const fields = expenseFieldsFromForm(
      valid({ nature: 'INVENTORY_PURCHASE', category: 'fuel' }),
      payers,
    )
    expect(fields.category).toBe('inventory')
  })

  it('requires an operating category, a known payer, an origin, a date and a description', () => {
    expect(() => expenseFieldsFromForm(valid({ category: '' }), payers)).toThrow('categoría')
    expect(() => expenseFieldsFromForm(valid({ category: 'inventory' }), payers)).toThrow('categoría')
    expect(() => expenseFieldsFromForm(valid({ paidByMemberId: 'x' }), payers)).toThrow('quién pagó')
    expect(() => expenseFieldsFromForm(valid({ fundsSource: '' }), payers)).toThrow('origen')
    expect(() => expenseFieldsFromForm(valid({ date: '2026-02-30' }), payers)).toThrow('fecha')
    expect(() => expenseFieldsFromForm(valid({ description: '  ' }), payers)).toThrow('Describe')
    expect(() => expenseFieldsFromForm(valid({ description: 'x'.repeat(281) }), payers)).toThrow('caracteres')
  })

  it('changing the type keeps the category consistent', () => {
    const inventory = withNature(valid(), 'INVENTORY_PURCHASE')
    expect(inventory.category).toBe('inventory')
    expect(withNature(inventory, 'OPERATING_EXPENSE').category).toBe('')
    expect(withNature(valid(), 'OPERATING_EXPENSE').category).toBe('transport')
  })

  it('round-trips an existing expense into the correction form', () => {
    const form = formFromExpense({
      nature: 'OPERATING_EXPENSE',
      category: 'fuel',
      amountMinor: 123456,
      occurredAt: '2026-10-03T06:00:00Z',
      paidByMemberId: 'ana',
      fundsSource: 'PERSONAL',
      description: 'Gasolina',
    })
    expect(form).toMatchObject({ amount: '1234.56', date: '2026-10-03' })
    expect(expenseFieldsFromForm(form, payers).amountMinor).toBe(123456)
  })
})
