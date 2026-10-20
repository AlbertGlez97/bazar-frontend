import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExpenseFormFields from '../ExpenseFormFields.vue'
import { emptyExpenseForm } from '@/utils/expense-form'

const mountIt = () => mount(ExpenseFormFields, {
  props: { modelValue: emptyExpenseForm('2026-10-01'), payers: [{ id: 'a', name: 'Ana' }], idPrefix: 'gasto' },
  attachTo: document.body,
})

describe('ExpenseFormFields — aviso junto a "Pagado por"', () => {
  it('dice que la app no reembolsa a quien pague con su dinero y que el gasto cuenta igual', () => {
    const hint = mountIt().get('[data-test="paid-by-hint"]')
    expect(hint.text()).toBe('La app no le devuelve a nadie el dinero que ponga de su bolsa. El gasto cuenta igual en el resultado.')
  })

  it('el campo "Pagado por" queda descrito por ese aviso (lectores de pantalla)', () => {
    const w = mountIt()
    const hintId = w.get('[data-test="paid-by-hint"]').attributes('id')!
    expect(w.get('#gasto-payer').attributes('aria-describedby')).toContain(hintId)
  })

  it('sigue estando el aviso de que no se convierte en aportación', () => {
    expect(mountIt().text()).toContain('el gasto no se convierte en una aportación')
  })
})
