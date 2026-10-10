import type {
  WorkShift,
  WorkShiftPayload,
  WorkShiftReversalPayload,
} from '@/types/work-shift.types'
import type { FinanceOrigin } from './contributions-records'

/** A creation, or the annulment/correction of a confirmed (or still queued) shift. */
export type WorkShiftOperation =
  | { kind: 'create'; payload: WorkShiftPayload }
  | { kind: 'reverse'; workShiftId: string; payload: WorkShiftReversalPayload }

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
