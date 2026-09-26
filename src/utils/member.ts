import type { Member } from '@/types/member.types'

/**
 * Runtime check for a stored or received member: enough shape to trust the
 * `role` (the only field the route guards and menus read). Anything else,
 * including an unknown role, is not a member.
 */
export function isMember(value: unknown): value is Member {
  const v = value as Partial<Member> | null
  return !!v && typeof v.id === 'string' && typeof v.name === 'string'
    && (v.role === 'socio' || v.role === 'colaborador')
}
