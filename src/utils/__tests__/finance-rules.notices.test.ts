import { describe, expect, it } from 'vitest'
import {
  approvalSource,
  missingCorreoText,
  partnerStatusText,
  resendNotice,
  resendState,
  submitNotice,
} from '../finance-rules'
import { ANA, BETO, approval, partnerStatus, ruleSet } from '@/services/__tests__/finance-rules.fixture'

describe('avisos de envío y de reenvío', () => {
  it('dice a quién llegó el correo y a quién no', () => {
    expect(submitNotice({ sent: ['Ana', 'Beto'], failed: [] })).toBe('Enviamos el correo a Ana y Beto.')
    expect(submitNotice({ sent: ['Ana'], failed: ['Beto'] })).toBe(
      'Enviamos el correo a Ana. No pudimos enviar el correo a Beto. Usa «Reenviar correo» para intentarlo otra vez.',
    )
    expect(submitNotice({ sent: [], failed: ['Ana', 'Beto'] })).toContain('No pudimos enviar el correo a Ana y Beto.')
    expect(submitNotice({ sent: [], failed: [] })).toBe('')
  })

  it('dice a quién se reenvió, a quién no, y cuándo ya no falta nadie', () => {
    expect(resendNotice({ activated: true, resent: [], skipped: [], noEmail: [] })).toBe('Ya respondieron todos. Las reglas quedaron vigentes.')
    expect(resendNotice({ activated: false, resent: [], skipped: [], noEmail: [] })).toBe('No falta nadie por responder.')
    expect(resendNotice({
      activated: false,
      resent: [{ name: 'Ana', emailSent: true }, { name: 'Beto', emailSent: false }],
      skipped: [{ name: 'Carla' }],
      noEmail: [{ name: 'Diego' }],
    })).toBe(
      'Reenviamos el correo a Ana. No pudimos enviar el correo a Beto. Inténtalo otra vez. A Carla ya se le reenvió hace menos de 24 horas. A Diego le falta el correo.',
    )
  })

  it('avisa a quién le falta el correo antes de enviar, y nada si no falta nadie', () => {
    expect(missingCorreoText([])).toBe('')
    expect(missingCorreoText(['Ana'])).toBe('Falta el correo de Ana. Hasta que lo escriban, no se puede enviar la propuesta.')
    expect(missingCorreoText(['Ana', 'Beto', 'Carla'])).toContain('Ana, Beto y Carla')
  })

  it('ninguna frase de los avisos pasa de 20 palabras', () => {
    const texts = [
      submitNotice({ sent: ['Ana'], failed: ['Beto'] }),
      resendNotice({ activated: false, resent: [{ name: 'Ana', emailSent: false }], skipped: [{ name: 'Beto' }], noEmail: [{ name: 'Carla' }] }),
      missingCorreoText(['Ana', 'Beto']),
    ]
    for (const text of texts)
      for (const sentence of text.split(/(?<=[.!?»])\s+/)) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
  })
})

describe('de dónde vino cada respuesta', () => {
  it('una aprobación por correo dice desde qué correo (enmascarado); una anterior, que fue desde una sesión', () => {
    expect(approvalSource({ correo: 'a***@e***.com', via: 'correo' })).toBe('Aprobó desde el correo a***@e***.com.')
    expect(approvalSource({ correo: null, via: 'sesion' })).toBe('Aprobó desde su sesión, antes de que se aprobara por correo.')
  })

  const proposal = ruleSet({ status: 'pendiente', approvals: [approval(ANA)] })
  it('cada socio dice qué respondió o qué le falta', () => {
    expect(partnerStatusText(partnerStatus(ANA, { response: 'aprobo' }), proposal)).toBe('Ana: aprobó el 20/10/2026, 10:05.')
    expect(partnerStatusText(partnerStatus(BETO, { response: 'aprobo' }), ruleSet())).toBe('Beto: aprobó.')
    expect(partnerStatusText(partnerStatus(BETO, { response: 'objeto' }), proposal)).toBe('Beto: no está de acuerdo.')
    expect(partnerStatusText(partnerStatus(BETO, { hasCorreo: false, correo: null }), proposal)).toBe('Beto: falta su correo.')
    expect(partnerStatusText(partnerStatus(BETO), proposal)).toBe('Beto: falta responder.')
    const link = { sentAt: '2026-10-20T16:00:00.000Z', expiresAt: '2026-10-27T16:00:00.000Z', expired: false, canResendAt: null }
    expect(partnerStatusText(partnerStatus(BETO, { link }), proposal)).toBe('Beto: falta responder. Correo enviado el 20/10/2026, 10:00.')
    expect(partnerStatusText(partnerStatus(BETO, { link: { ...link, expired: true } }), proposal)).toBe(
      'Beto: el enlace venció el 27/10/2026. Reenvía el correo.',
    )
  })
})

describe('resendState: cuándo se puede reenviar', () => {
  const link = (canResendAt: string | null) => ({ sentAt: '2026-10-20T16:00:00.000Z', expiresAt: '2026-10-27T16:00:00.000Z', expired: false, canResendAt })

  it('si nadie falta, no hay a quién reenviar', () => {
    expect(resendState([partnerStatus(ANA, { response: 'aprobo' })])).toEqual({ allowed: false, hint: 'No falta nadie por responder.' })
    expect(resendState([])).toEqual({ allowed: false, hint: 'No falta nadie por responder.' })
  })

  it('a quien le falta el correo no se le puede reenviar', () => {
    expect(resendState([partnerStatus(BETO, { hasCorreo: false, correo: null })])).toEqual({
      allowed: false,
      hint: 'A quienes faltan les falta el correo. Primero deben escribirlo.',
    })
  })

  it('se puede mientras a alguien que falta no se le haya reenviado en 24 horas', () => {
    expect(resendState([partnerStatus(BETO)]).allowed).toBe(true)
    expect(resendState([partnerStatus(BETO, { link: link(null) })]).allowed).toBe(true)
    expect(resendState([partnerStatus(ANA, { link: link('2026-10-22T10:00:00.000Z') }), partnerStatus(BETO, { link: link(null) })]).allowed).toBe(true)
  })

  it('si a todos los que faltan ya se les reenvió, dice cuándo podrá repetirse (lo más pronto)', () => {
    const state = resendState([
      partnerStatus(ANA, { link: link('2026-10-22T20:00:00.000Z') }),
      partnerStatus(BETO, { link: link('2026-10-22T10:00:00.000Z') }),
    ])
    expect(state.allowed).toBe(false)
    expect(state.hint).toBe('Ya reenviaste el correo hace menos de 24 horas. Podrás hacerlo de nuevo el 22/10/2026, 04:00.')
  })
})
