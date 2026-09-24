// Servicio de metas de ahorro: CRUD de metas y contribuciones (records)
import api from './api'
import type { SavingGoal, SavingContribution } from '@/types/savings.types'

const SavingsService = {
  // ── Metas ────────────────────────────────────────────────────────────────
  async getAll(): Promise<SavingGoal[]> {
    const { data } = await api.get<SavingGoal[]>('/savings')
    return data
  },

  async getOne(id: string): Promise<SavingGoal> {
    const { data } = await api.get<SavingGoal>(`/savings/${id}`)
    return data
  },

  async create(payload: Omit<SavingGoal, 'id' | 'currentAmount' | 'isCompleted' | 'createdAt'>): Promise<SavingGoal> {
    const { data } = await api.post<SavingGoal>('/savings', payload)
    return data
  },

  async update(id: string, payload: Partial<SavingGoal>): Promise<SavingGoal> {
    const { data } = await api.patch<SavingGoal>(`/savings/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/savings/${id}`)
  },

  // ── Contribuciones (records en el backend) ───────────────────────────────
  // El backend expone el historial bajo `/savings/:id/records` — el dialecto
  // "contribución" es solo del lado UI, así que mantenemos los nombres de
  // función con la semántica del usuario y alineamos la URL con la API real.
  async getContributions(goalId: string): Promise<SavingContribution[]> {
    const { data } = await api.get<SavingContribution[]>(`/savings/${goalId}/records`)
    return data
  },

  async addContribution(
    goalId: string,
    payload: Pick<SavingContribution, 'amount' | 'date' | 'note'>
  ): Promise<SavingContribution> {
    const { data } = await api.post<SavingContribution>(`/savings/${goalId}/records`, payload)
    return data
  },
}

export default SavingsService
