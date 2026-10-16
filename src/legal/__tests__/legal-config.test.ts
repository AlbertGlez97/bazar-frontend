import { describe, expect, it } from 'vitest'
import configSource from '../legal-config.ts?raw'
import {
  ARCO,
  LEGAL_CONTACT_EMAIL,
  LEGAL_JURISDICTION,
  LEGAL_RESPONSIBLE,
  RETENTION,
} from '../legal-config'
import { LEGAL_VERSION, formatLegalVersionDate } from '../versions'
import { LEGAL_LINKS } from '../legal-links'

describe('legal-config: datos del responsable y plazos, en un solo lugar', () => {
  it('el responsable es Juan Alberto González de la Cruz, persona física', () => {
    expect(LEGAL_RESPONSIBLE.name).toBe('Juan Alberto González de la Cruz')
    expect(LEGAL_RESPONSIBLE.kind).toBe('persona física')
  })

  it('domicilio provisional: Acolman, Estado de México', () => {
    expect(LEGAL_RESPONSIBLE.address).toBe('Acolman, Estado de México')
  })

  it('el correo de contacto y de privacidad es el mismo', () => {
    expect(LEGAL_CONTACT_EMAIL).toBe('albert.gonzalez0297@gmail.com')
    expect(LEGAL_RESPONSIBLE.email).toBe(LEGAL_CONTACT_EMAIL)
  })

  it('plazos de conservación: 7 días sin confirmar y 30 días rechazadas o vencidas', () => {
    expect(RETENTION.unconfirmedRegistrationDays).toBe(7)
    expect(RETENTION.rejectedOrExpiredRegistrationDays).toBe(30)
  })

  it('plazos ARCO de la ley: 20 días para responder y 15 para hacerlo efectivo', () => {
    expect(ARCO.responseDays).toBe(20)
    expect(ARCO.effectDays).toBe(15)
  })

  it('los plazos son enteros positivos', () => {
    for (const days of [...Object.values(RETENTION), ...Object.values(ARCO)]) {
      expect(Number.isInteger(days)).toBe(true)
      expect(days).toBeGreaterThan(0)
    }
  })

  it('la jurisdicción menciona el Estado de México', () => {
    expect(LEGAL_JURISDICTION).toContain('Estado de México')
  })

  it('lo provisional está marcado con el comentario "provisional, revisar con abogado"', () => {
    const marks = configSource.match(/provisional, revisar con abogado/g) ?? []
    // domicilio, plazos de conservación, jurisdicción y correo
    expect(marks.length).toBeGreaterThanOrEqual(3)
    expect(configSource).toMatch(/\/\/[^\n]*provisional, revisar con abogado[^\n]*\n\s+address:/)
  })

  it('el config no afirma una revisión de abogado', () => {
    expect(configSource).not.toMatch(/revisad[oa] por (un )?abogad/i)
  })
})

describe('versions: versión de los textos', () => {
  it('LEGAL_VERSION es 2026-10-16 con formato AAAA-MM-DD', () => {
    expect(LEGAL_VERSION).toBe('2026-10-16')
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('la fecha se muestra en español claro', () => {
    expect(formatLegalVersionDate('2026-10-16')).toBe('16 de octubre de 2026')
    expect(formatLegalVersionDate('2027-01-05')).toBe('5 de enero de 2027')
  })

  it('una versión inválida no inventa una fecha', () => {
    expect(formatLegalVersionDate('hoy')).toBe('hoy')
  })
})

describe('legal-links', () => {
  it('declara los dos enlaces: aviso de privacidad y términos', () => {
    expect(LEGAL_LINKS.map((link) => link.to)).toEqual(['/privacidad', '/terminos'])
    expect(LEGAL_LINKS.map((link) => link.label)).toEqual(['Aviso de privacidad', 'Términos y condiciones'])
  })
})
