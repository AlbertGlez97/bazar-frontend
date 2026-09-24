// Cálculo del aporte mensual efectivo y proyección de cierre para una
// meta de ahorro. Espeja la lógica del backend (savings.service →
// FREQUENCY_TO_MONTHLY_MULTIPLIER + buildGoalDetail) para que la UI
// pueda mostrar la misma proyección sobre las metas que ya viajan en
// el listado (GET /savings) sin tener que llamar al detalle por cada
// card. Si en algún momento el listado del backend pasa a devolver el
// resultado de buildGoalDetail, este helper queda como fallback.
import type { SavingFrequency, SavingGoal } from '@/types/savings.types'

// Multiplicador para convertir el aporte por período → aporte mensual.
// 'semanal' usa 52/12 = 13/3 ≈ 4.333 — más preciso que 4.33 sin perder
// claridad. 'unico' es 0 porque por definición no hay cadencia.
const FREQUENCY_TO_MONTHLY_MULTIPLIER: Record<SavingFrequency, number> = {
  mensual:   1,
  quincenal: 2,
  semanal:   13 / 3,
  unico:     0,
}

export interface GoalProjection {
  /** Aporte mensual EFECTIVO (ya considerada la frecuencia). 0 si frecuencia=unico. */
  aporteMensualEfectivo: number
  /** Meses para alcanzar el objetivo. null cuando no hay proyección automática. */
  mesesRestantes:        number | null
  /** ISO YYYY-MM-DD proyectada. null si no hay proyección. */
  fechaEstimada:         string | null
  /** True si la frecuencia es 'unico' — no hay aporte recurrente. */
  esAporteUnico:         boolean
  /** True si la meta ya alcanzó su objetivo (currentAmount ≥ targetAmount). */
  cumplida:              boolean
}

type ProjectableGoal = Pick<
  SavingGoal,
  'frequency' | 'minimumMonthlyContribution' | 'currentAmount' | 'targetAmount'
>

/** Calcula la proyección de cierre de una meta a partir de la entidad cruda
 *  que devuelve `GET /savings`. Toda la lógica vive aquí — la card no debería
 *  hacer math inline.
 *
 *  Reglas (espejo del backend):
 *  - Meta cumplida → mesesRestantes=0, sin fecha estimada.
 *  - frecuencia=unico O aporte=0 → mesesRestantes=null, fechaEstimada=null.
 *    El componente decide qué mensaje mostrar.
 *  - Resto → ceil(faltante / aporteEfectivo) y `hoy + N meses`.
 */
export function computeGoalProjection(goal: ProjectableGoal): GoalProjection {
  const target  = Number(goal.targetAmount)
  const current = Number(goal.currentAmount)
  const aporte  = Number(goal.minimumMonthlyContribution)
  const faltante = +(target - current).toFixed(2)
  const cumplida = faltante <= 0

  if (cumplida) {
    return {
      aporteMensualEfectivo: 0,
      mesesRestantes:        0,
      fechaEstimada:         null,
      esAporteUnico:         false,
      cumplida:              true,
    }
  }

  const esAporteUnico = goal.frequency === 'unico'
  const multiplier    = FREQUENCY_TO_MONTHLY_MULTIPLIER[goal.frequency] ?? 1
  const aporteMensualEfectivo = +(aporte * multiplier).toFixed(2)

  if (esAporteUnico || aporteMensualEfectivo <= 0) {
    return {
      aporteMensualEfectivo: 0,
      mesesRestantes:        null,
      fechaEstimada:         null,
      esAporteUnico,
      cumplida:              false,
    }
  }

  const mesesRestantes = Math.ceil(faltante / aporteMensualEfectivo)
  const d = new Date()
  d.setMonth(d.getMonth() + mesesRestantes)
  const fechaEstimada = d.toISOString().split('T')[0]

  return {
    aporteMensualEfectivo,
    mesesRestantes,
    fechaEstimada,
    esAporteUnico: false,
    cumplida:      false,
  }
}
