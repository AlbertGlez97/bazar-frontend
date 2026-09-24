// Contrato real de bazar-api para GET /members.
// La respuesta es un array plano (sin paginación) y OMITE contextId y
// commissionRateBps — el backend hace un select explícito de solo estos 4
// campos para el selector de persona (ver doc/api-contract-for-frontend.md §3).
export type MemberRole = 'socio' | 'colaborador'

export interface Member {
  id: string
  name: string
  role: MemberRole
  active: boolean
}
