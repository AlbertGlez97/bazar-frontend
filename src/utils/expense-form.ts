import { businessDayOf, isValidDateKey } from '@/utils/business-time'
import { MAX_MONEY_MINOR } from '@/services/finance-shared'
import { parseMoneyText, minorToDisplay } from '@/utils/money'
import {
  INVENTORY_CATEGORY,
  OPERATING_CATEGORIES,
  isFundsSource,
  isNature,
} from '@/utils/expense-catalog'
import type {
  ExpenseCategory,
  ExpenseFields,
  ExpenseNature,
  ExpensePayload,
  FundsSource,
} from '@/types/expense.types'

export const EXPENSE_DESCRIPTION_MAX = 1000

/** Raw form state: texts as typed; `''` means "not chosen yet". */
export interface ExpenseFormState {
  nature: ExpenseNature
  category: ExpenseCategory | ''
  amount: string
  date: string
  paidByMemberId: string
  fundsSource: FundsSource | ''
  description: string
}

export class ExpenseFormError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExpenseFormError'
  }
}

export function emptyExpenseForm(day: string): ExpenseFormState {
  return {
    nature: 'OPERATING_EXPENSE',
    category: '',
    amount: '',
    date: day,
    paidByMemberId: '',
    fundsSource: '',
    description: '',
  }
}

export function formFromExpense(
  e: Pick<
    ExpensePayload,
    | 'nature'
    | 'category'
    | 'amountMinor'
    | 'occurredAt'
    | 'paidByMemberId'
    | 'fundsSource'
    | 'description'
  >,
): ExpenseFormState {
  return {
    nature: e.nature,
    category: e.category,
    amount: minorToDisplay(e.amountMinor),
    date: businessDayOf(e.occurredAt),
    paidByMemberId: e.paidByMemberId,
    fundsSource: e.fundsSource,
    description: e.description,
  }
}

/** Changing the type keeps the category consistent with it. */
export function withNature(
  form: ExpenseFormState,
  nature: ExpenseNature,
): ExpenseFormState {
  if (nature === 'INVENTORY_PURCHASE')
    return { ...form, nature, category: INVENTORY_CATEGORY }
  return {
    ...form,
    nature,
    category: form.category === INVENTORY_CATEGORY ? '' : form.category,
  }
}

/**
 * Validates the form and converts it to the API fields: integer minor units
 * (never floats), business-day midnight, trimmed description.
 */
export function expenseFieldsFromForm(
  form: ExpenseFormState,
  payers: readonly { id: string }[],
): ExpenseFields {
  if (!isNature(form.nature)) throw new ExpenseFormError('Elige el tipo de gasto.')
  const category =
    form.nature === 'INVENTORY_PURCHASE' ? INVENTORY_CATEGORY : form.category
  if (
    form.nature === 'OPERATING_EXPENSE' &&
    !OPERATING_CATEGORIES.some((c) => c.code === category)
  )
    throw new ExpenseFormError('Elige la categoría del gasto.')
  const amountMinor = parseMoneyText(form.amount)
  if (amountMinor === null || amountMinor < 1 || amountMinor > MAX_MONEY_MINOR)
    throw new ExpenseFormError(
      'Escribe un importe válido mayor a cero, por ejemplo 450.50.',
    )
  if (!isValidDateKey(form.date))
    throw new ExpenseFormError('Elige una fecha válida.')
  if (!payers.some((m) => m.id === form.paidByMemberId))
    throw new ExpenseFormError('Elige quién pagó.')
  if (!isFundsSource(form.fundsSource))
    throw new ExpenseFormError('Elige el origen del dinero.')
  const description = form.description.trim()
  if (!description) throw new ExpenseFormError('Describe el gasto.')
  if (description.length > EXPENSE_DESCRIPTION_MAX)
    throw new ExpenseFormError(
      `La descripción admite hasta ${EXPENSE_DESCRIPTION_MAX} caracteres.`,
    )
  return {
    amountMinor,
    occurredAt: `${form.date}T00:00:00-06:00`,
    nature: form.nature,
    category: category as ExpenseCategory,
    description,
    paidByMemberId: form.paidByMemberId,
    fundsSource: form.fundsSource,
  }
}
