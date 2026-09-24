// Tipos para el módulo de Ahorros

export type SavingFrequency = 'mensual' | 'quincenal' | 'semanal' | 'unico'

export interface SavingGoal {
  id:              string
  name:            string
  targetAmount:    number
  currentAmount:   number
  targetDate:      string | null
  frequency:       SavingFrequency
  minimumMonthlyContribution: number
  isCompleted:     boolean
  notes:           string | null
  createdAt:       string
}

// Contribución registrada hacia una meta
export interface SavingContribution {
  id:            string
  savingGoalId:  string
  amount:        number
  date:          string
  note:          string | null
  createdAt:     string
}

