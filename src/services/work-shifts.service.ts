import api from './api'
import { validWorkShiftPage, validWorkShiftSummary } from './work-shift-sync'
import type { WorkShiftFilter, WorkShiftSummary } from '@/types/work-shift.types'
import type { FinanceOrigin } from './contributions-records'
import type { PendingWorkShift } from './work-shift-records'

const headers = (origin: FinanceOrigin) => ({
  'x-member-id': origin.memberId,
  'x-device-id': origin.deviceId,
})

export const WorkShiftsService = {
  async send(record: PendingWorkShift): Promise<unknown> {
    const path =
      record.kind === 'create'
        ? '/finance/work-shifts'
        : `/finance/work-shifts/${record.workShiftId}/reversals`
    return (
      await api.post(path, record.payload, {
        headers: headers(record.origin),
        financialOrigin: record.origin,
        skipAuthRedirect: true,
      } as Parameters<typeof api.post>[2])
    ).data
  },
  async list(origin: FinanceOrigin, filter: WorkShiftFilter = {}) {
    const { data } = await api.get('/finance/work-shifts', {
      params: filter,
      headers: headers(origin),
      financialOrigin: origin,
    } as Parameters<typeof api.get>[1])
    if (!validWorkShiftPage(data, origin))
      throw new Error('Invalid work shift list response')
    return data
  },
  async summary(
    origin: FinanceOrigin,
    filter: Pick<WorkShiftFilter, 'from' | 'to' | 'memberId'>,
  ): Promise<WorkShiftSummary> {
    const { data } = await api.get('/finance/work-shifts/summary', {
      params: filter,
      headers: headers(origin),
      financialOrigin: origin,
    } as Parameters<typeof api.get>[1])
    if (!validWorkShiftSummary(data))
      throw new Error('Invalid work shift summary response')
    return data
  },
}
