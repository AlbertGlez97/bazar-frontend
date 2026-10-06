import type { WorkShift, WorkShiftPayload } from '@/types/work-shift.types'
import type { FinanceOrigin } from './contributions-records'

/** Only creation is queued: corrections are not available yet. */
export type WorkShiftOperation = { kind: 'create'; payload: WorkShiftPayload }

export type PendingWorkShift = WorkShiftOperation & {
  key: string
  scope: string
  id: string
  origin: FinanceOrigin
  createdAt: string
  state: 'pending' | 'needs_review' | 'paused'
  attempts: number
  nextAttemptAt: number
  lastError?: string
}

export interface WorkShiftHistory {
  key: string
  scope: string
  workShift: WorkShift
}
