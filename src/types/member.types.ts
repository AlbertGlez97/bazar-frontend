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

// Contrato real de POST /members (solo socios, BE-12). Crea a la persona y su
// propio inicio de sesión, y le manda por correo su usuario y una contraseña
// temporal. El `correo` solo sirve para eso: el servidor no lo guarda.
export interface CreateMemberPayload {
  nombre: string
  apellidos: string
  correo: string
  role: MemberRole
  /**
   * Puntos base enteros (1000 = 10.00 %), 0..10000. Solo para un colaborador y
   * OMITIDO cuando no se elige ninguna (usa la comisión general): el servidor
   * rechaza el campo para un socio aunque vaya en null.
   */
  commissionRateBps?: number
}

export interface CreatedMember {
  id: string
  name: string
  role: MemberRole
  active: boolean
  commissionRateBps: number | null
  createdByMemberId: string | null
  /** Con lo que la persona inicia sesión. Nunca viene la contraseña. */
  username: string
  /**
   * Adónde fueron las credenciales: `member` = al correo de la persona;
   * `approver-fallback` = el proveedor de correo estaba en modo de prueba y las
   * mandó a quien aprueba los registros, NO a la persona.
   */
  credentialsEmail: 'member' | 'approver-fallback'
}
