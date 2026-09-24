import { describe, it, expect } from 'vitest'
import { calculateSummary } from '@/services/calculators/summary.calculator'
import type { Income, Bill, Expense, Transaction } from '@/types/budget.types'

// ── Factories ──────────────────────────────────────────────────────────────

const mkIncome = (budgeted: number): Income => ({
  id: 'i', name: 'Salario', budgeted, actual: budgeted,
  budgetId: 'b', createdAt: '2026-01-01',
})

const mkBill = (budgeted: number, actual: number): Bill => ({
  id: 'bill', name: 'Renta', budgeted, actual,
  isPaid: false, paymentType: null, dueDate: null,
  budgetId: 'b', createdAt: '2026-01-01',
})

const mkExpense = (budgeted: number): Expense => ({
  id: 'e', category: 'mercado', budgeted, actual: 0,
  paymentType: null, budgetId: 'b', createdAt: '2026-01-01',
})

const mkTx = (amount: number): Transaction => ({
  id: 'tx', amount, category: 'mercado', paymentType: null,
  note: null, date: '2026-07-10', budgetId: 'b', createdAt: '2026-07-10',
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('summary.calculator — calculateSummary()', () => {
  it('retorna ceros cuando todos los arrays están vacíos', () => {
    const s = calculateSummary([], [], [], [])
    expect(s.totalIngresos).toBe(0)
    expect(s.totalFacturas).toBe(0)
    expect(s.totalGastosFijos).toBe(0)
    expect(s.totalGastosVariables).toBe(0)
    expect(s.totalGastado).toBe(0)
    expect(s.disponible).toBe(0)
  })

  it('calcula correctamente los totales con datos reales', () => {
    const incomes = [mkIncome(20000)]
    const bills   = [mkBill(5000, 4800)]
    const expenses = [mkExpense(3000)]
    const txs     = [mkTx(1200), mkTx(800)]

    const s = calculateSummary(incomes, bills, expenses, txs)

    expect(s.totalIngresos).toBe(20000)
    expect(s.totalFacturas).toBe(4800)        // actual de bills
    expect(s.totalGastosFijos).toBe(5000)     // budgeted de bills
    expect(s.totalGastosVariables).toBe(3000) // budgeted de expenses
    expect(s.totalGastado).toBe(6800)         // 4800 + 1200 + 800
    expect(s.disponible).toBe(13200)          // 20000 - 6800
  })

  it('aplica la regla 50/30/20 por defecto', () => {
    const s = calculateSummary([mkIncome(10000)], [], [], [])
    expect(s.regla.necesidades.porcentaje).toBe(50)
    expect(s.regla.deseos.porcentaje).toBe(30)
    expect(s.regla.ahorro.porcentaje).toBe(20)
    expect(s.regla.necesidades.limite).toBe(5000)
    expect(s.regla.deseos.limite).toBe(3000)
    expect(s.regla.ahorro.limite).toBe(2000)
  })

  it('aplica una regla personalizada', () => {
    const rule = { necesidades: 60, deseos: 20, ahorro: 20 }
    const s = calculateSummary([mkIncome(10000)], [], [], [], rule)
    expect(s.regla.necesidades.limite).toBe(6000)
    expect(s.regla.deseos.limite).toBe(2000)
    expect(s.regla.ahorro.limite).toBe(2000)
  })

  it('disponible no es negativo en ahorro.actual cuando se gasta más que lo ingresado', () => {
    // 5000 ingresos, 8000 gastado → disponible negativo
    const s = calculateSummary(
      [mkIncome(5000)],
      [mkBill(3000, 3000)],
      [],
      [mkTx(5000)],
    )
    expect(s.disponible).toBeLessThan(0)      // disponible puede ser negativo
    expect(s.regla.ahorro.actual).toBe(0)     // pero ahorro.actual = 0, nunca negativo
  })

  it('cuenta múltiples transacciones en totalGastado', () => {
    const txs = [mkTx(100), mkTx(200), mkTx(300)]
    const s   = calculateSummary([mkIncome(5000)], [], [], txs)
    expect(s.totalGastado).toBe(600)
  })

  it('regla.necesidades.actual incluye facturas + transacciones', () => {
    const s = calculateSummary(
      [mkIncome(20000)],
      [mkBill(5000, 4000)],
      [],
      [mkTx(1000)],
    )
    expect(s.regla.necesidades.actual).toBe(5000) // 4000 facturas + 1000 tx
  })
})
