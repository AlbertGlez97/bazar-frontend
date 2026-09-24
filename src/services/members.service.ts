import api from './api'
import type { Member } from '@/types/member.types'

const MembersService = {
  /**
   * Lista los members activos del negocio para el selector de persona.
   * Solo exige AuthGuard (Bearer token) — no requiere x-member-id/x-device-id,
   * ya que este endpoint se usa precisamente ANTES de tenerlos elegidos.
   */
  async list(): Promise<Member[]> {
    const { data } = await api.get<Member[]>('/members')
    return data
  },
}

export default MembersService
