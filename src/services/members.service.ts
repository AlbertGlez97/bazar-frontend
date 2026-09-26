import api from './api'
import type { CreatedMember, CreateMemberPayload, Member } from '@/types/member.types'

const MembersService = {
  /**
   * Lista los members del negocio.
   * Solo exige AuthGuard (Bearer token) — no requiere x-member-id/x-device-id,
   * ya que este endpoint se usa precisamente ANTES de tenerlos elegidos (selector
   * de persona). Con `includeInactive` también pide a las personas desactivadas;
   * el servidor solo lo respeta cuando `x-member-id` es un socio activo (la
   * pantalla "Mi equipo", que ya tiene su persona elegida) y si no lo ignora.
   */
  async list(options: { includeInactive?: boolean } = {}): Promise<Member[]> {
    const { data } = options.includeInactive
      ? await api.get<Member[]>('/members', { params: { includeInactive: true } })
      : await api.get<Member[]>('/members')
    return data
  },

  /**
   * Agrega una persona al negocio (solo socios). 201 con la persona creada y
   * adónde fue el correo con sus credenciales. Errores que la vista distingue por
   * estado HTTP: 400 datos inválidos, 403 no es socio, 409 no se pudo asignar
   * usuario, 502 el correo no salió (y no se creó nada).
   */
  async create(payload: CreateMemberPayload): Promise<CreatedMember> {
    const { data } = await api.post<CreatedMember>('/members', payload)
    return data
  },
}

export default MembersService
