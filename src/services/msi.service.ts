import api from './api'
import type { MsiPurchase, CreateMsiPayload } from '@/types/msi.types'

export const MsiService = {
  async getAll(): Promise<MsiPurchase[]> {
    const { data } = await api.get<MsiPurchase[]>('/msi')
    return data
  },

  async getActive(year: number, month: number): Promise<MsiPurchase[]> {
    const { data } = await api.get<MsiPurchase[]>('/msi/active', { params: { year, month } })
    return data
  },

  async create(payload: CreateMsiPayload): Promise<MsiPurchase> {
    const { data } = await api.post<MsiPurchase>('/msi', payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/msi/${id}`)
  },
}
