import { describe, expect, it } from 'vitest'
import {
  MAX_PASSWORD,
  MIN_PASSWORD,
  inviteStatusText,
  invitationErrorMessage,
  originText,
  passwordProblem,
  recentInviteNotice,
  resendState,
} from '../account-invitations'
import type { InvitationStatus } from '@/types/account-invitation.types'

const fail = (status: number, code?: string, message?: string) => ({ response: { status, data: { code, message } } })

describe('passwordProblem', () => {
  it('pide entre 10 y 128 caracteres, igual que el cambio de contraseña', () => {
    expect(MIN_PASSWORD).toBe(10)
    expect(MAX_PASSWORD).toBe(128)
    expect(passwordProblem('corta', 'corta')).toBe('Tu contraseña debe tener al menos 10 caracteres.')
    expect(passwordProblem('x'.repeat(129), 'x'.repeat(129))).toBe('Tu contraseña puede tener hasta 128 caracteres.')
    expect(passwordProblem('x'.repeat(10), 'x'.repeat(10))).toBe('')
    expect(passwordProblem('x'.repeat(128), 'x'.repeat(128))).toBe('')
  })

  it('las dos contraseñas deben coincidir y no se recortan espacios', () => {
    expect(passwordProblem('una-clave-larga', 'una-clave-larga ')).toBe('Las dos contraseñas deben ser iguales.')
    expect(passwordProblem('  espacios  ', '  espacios  ')).toBe('')
  })

  it('vacía no es una contraseña', () => {
    expect(passwordProblem('', '')).toBe('Escribe una contraseña.')
  })
})

describe('invitationErrorMessage', () => {
  it('usa el mensaje en español que manda el servidor en los casos que él explica', () => {
    for (const code of ['INVITATION_NOT_SENT', 'INVITATION_TOO_SOON', 'INVITATION_DAILY_LIMIT', 'INVITATION_INVALID', 'INVITATION_RATE_LIMITED'])
      expect(invitationErrorMessage(fail(422, code, 'Mensaje del servidor.'))).toBe('Mensaje del servidor.')
  })

  it('sin mensaje del servidor, da uno sencillo', () => {
    expect(invitationErrorMessage(fail(422, 'INVITATION_NOT_SENT'))).toBe('No pudimos enviar la invitación a ese correo.')
    expect(invitationErrorMessage(fail(404, 'INVITATION_INVALID'))).toBe('Este enlace no sirve. Pide una invitación nueva.')
    expect(invitationErrorMessage(fail(429, 'INVITATION_RATE_LIMITED'))).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
  })

  it('los demás casos', () => {
    expect(invitationErrorMessage(fail(409))).toBe('Esta persona ya tiene su cuenta personal.')
    expect(invitationErrorMessage(fail(400))).toBe('Revisa el correo. Debe ser uno solo y estar bien escrito.')
    expect(invitationErrorMessage(fail(401))).toBe('La sesión venció. Inicia sesión de nuevo.')
    expect(invitationErrorMessage(fail(403))).toBe('Solo las personas socias pueden invitar.')
    expect(invitationErrorMessage(new Error('x'))).toBe('No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.')
  })
})

describe('estado de una invitación', () => {
  const NOW = new Date('2026-10-20T18:00:00.000Z')
  const status = (over: Partial<NonNullable<InvitationStatus['invitation']>> = {}): InvitationStatus => ({
    memberId: 'm1', name: 'Beto', hasPersonalAccount: false,
    invitation: {
      email: 'beto@example.test', sentAt: '2026-10-20T17:59:00.000Z', expiresAt: '2026-10-23T17:59:00.000Z',
      canResendAt: '2026-10-20T18:00:00.000Z', resendsLeftToday: 2, ...over,
    },
  })

  it('dice a quién se mandó y cuándo vence', () => {
    expect(inviteStatusText(status())).toBe('Invitación enviada a beto@example.test. Vence el 23/10/2026.')
  })

  it('sin invitación o con cuenta, no hay texto', () => {
    expect(inviteStatusText({ ...status(), invitation: null })).toBe('')
  })

  it('se puede reenviar pasado el minuto y mientras queden envíos', () => {
    expect(resendState(status(), NOW)).toEqual({ allowed: true, hint: '' })
    expect(resendState(status({ canResendAt: '2026-10-20T18:00:30.000Z' }), NOW)).toEqual({
      allowed: false, hint: 'Espera un minuto antes de reenviar.',
    })
    expect(resendState(status({ resendsLeftToday: 0 }), NOW)).toEqual({
      allowed: false, hint: 'Ya se enviaron 3 invitaciones hoy. Intenta mañana.',
    })
    expect(resendState({ ...status(), invitation: null }, NOW)).toEqual({ allowed: true, hint: '' })
  })
})

describe('origen de la cuenta de quien aprobó', () => {
  it('invitación: quién invitó y cuándo', () => {
    expect(originText({
      kind: 'invited', invitedByMemberId: 'a', invitedByName: 'Ana', invitedAt: '2026-10-18T16:00:00.000Z',
      acceptedAt: '2026-10-18T16:30:00.000Z', recent: true,
    })).toBe('Cuenta creada por invitación de Ana el 18/10/2026, 10:00.')
  })

  it('acceso compartido de un solo socio', () => {
    expect(originText({ kind: 'shared_single_partner' })).toBe('Acceso compartido de un solo socio.')
  })

  it('cuenta propia, con o sin fecha, y aprobaciones antiguas sin dato', () => {
    expect(originText({ kind: 'own_account', accountCreatedAt: '2026-09-01T12:00:00.000Z' })).toBe('Cuenta personal creada el 01/09/2026.')
    expect(originText({ kind: 'own_account', accountCreatedAt: null })).toBe('Cuenta personal.')
    expect(originText(null)).toBe('Sin dato de cómo se creó la cuenta.')
  })
})

describe('recentInviteNotice', () => {
  it('nombra a quien aprobó con una cuenta invitada hace poco y quién lo invitó', () => {
    expect(recentInviteNotice([
      { memberId: '1', name: 'Beto', invitedByName: 'Ana', acceptedAt: '2026-10-18T16:30:00.000Z' },
    ])).toBe('Beto aprobó con una cuenta invitada por Ana el 18/10/2026.')
    expect(recentInviteNotice([
      { memberId: '1', name: 'Beto', invitedByName: 'Ana', acceptedAt: '2026-10-18T16:30:00.000Z' },
      { memberId: '2', name: 'Carla', invitedByName: 'Ana', acceptedAt: '2026-10-19T16:30:00.000Z' },
    ])).toBe('Beto y Carla aprobaron con cuentas invitadas hace poco. Revisa el historial.')
  })

  it('sin cuentas invitadas recientes, no hay aviso', () => {
    expect(recentInviteNotice([])).toBe('')
  })
})
