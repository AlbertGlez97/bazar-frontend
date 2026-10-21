import { describe, expect, it } from 'vitest'
import {
  AGREEMENT_INVALID_TEXT,
  EMAIL_LINK_INVALID_TEXT,
  MAX_REASON,
  agreementErrorMessage,
  emailLinkErrorMessage,
  isInvalidLink,
  outcomeText,
  reasonProblem,
} from '../agreements'

const fail = (status: number, code?: string) => ({ response: { status, data: { code } } })

describe('páginas de los enlaces del correo', () => {
  it('un enlace que no sirve (404) se dice igual para cualquier motivo', () => {
    expect(isInvalidLink(fail(404))).toBe(true)
    expect(isInvalidLink(fail(500))).toBe(false)
    expect(isInvalidLink(new Error('x'))).toBe(false)
    expect(agreementErrorMessage(fail(404, 'AGREEMENT_LINK_INVALID'))).toBe(AGREEMENT_INVALID_TEXT)
    expect(emailLinkErrorMessage(fail(404, 'MEMBER_EMAIL_LINK_INVALID'))).toBe(EMAIL_LINK_INVALID_TEXT)
  })

  it('los demás errores se explican sin jerga', () => {
    expect(agreementErrorMessage(fail(429))).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
    expect(emailLinkErrorMessage(fail(429))).toBe('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
    expect(agreementErrorMessage(fail(400, 'AGREEMENT_REASON_REQUIRED'))).toBe('Escribe en pocas palabras por qué no estás de acuerdo.')
    expect(agreementErrorMessage(fail(400, 'AGREEMENT_REASON_TOO_LONG'))).toBe('Usa máximo 500 letras.')
    expect(agreementErrorMessage(fail(500))).toBe('No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.')
    expect(emailLinkErrorMessage(new Error('x'))).toBe('No pudimos completar la acción. Revisa tu conexión e inténtalo de nuevo.')
  })

  it('el motivo debe tener de 1 a 500 letras, sin contar espacios de los lados', () => {
    expect(reasonProblem('')).toBe('Escribe en pocas palabras por qué no estás de acuerdo.')
    expect(reasonProblem('   \n ')).toBe('Escribe en pocas palabras por qué no estás de acuerdo.')
    expect(reasonProblem('Quiero más reservas')).toBe('')
    expect(reasonProblem(` ${'x'.repeat(MAX_REASON)} `)).toBe('')
    expect(reasonProblem('x'.repeat(MAX_REASON + 1))).toBe('Usa máximo 500 letras.')
  })

  it('cada resultado dice lo que pasó, con frases de 20 palabras o menos', () => {
    expect(outcomeText('aprobada')).toEqual({ title: 'Listo, aprobaste', detail: 'Cuando todos los socios aprueben, las reglas entrarán en vigor.' })
    expect(outcomeText('vigente').detail).toBe('Eras el último en responder. Las reglas ya están vigentes.')
    expect(outcomeText('objetada')).toEqual({ title: 'Guardamos tu respuesta', detail: 'Los demás socios verán tu motivo. Recibirás la versión nueva por correo.' })
    expect(outcomeText('en_revision').detail).toBe('Esta propuesta está en revisión; recibirás la versión nueva por correo.')
    for (const outcome of ['aprobada', 'vigente', 'objetada', 'en_revision'] as const)
      for (const sentence of outcomeText(outcome).detail.split(/(?<=[.!?])\s+/)) expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(20)
  })
})
