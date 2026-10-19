import { describe, expect, it } from 'vitest'
import { PRIVACY_NOTICE } from '../privacy-notice'
import { LEGAL_CHANGELOG, LEGAL_VERSION, formatLegalVersionDate } from '../versions'
import type { LegalBlock } from '../types'

// La página de registro carga la verificación de seguridad de Cloudflare (Turnstile): el aviso
// de privacidad tiene que decirlo, decir qué datos técnicos recibe y que el tráfico pasa por
// Cloudflare; y como el texto cambió, la versión sube y queda constancia.

const section = (id: string) => {
  const found = PRIVACY_NOTICE.sections.find((s) => s.id === id)
  if (!found) throw new Error(`falta la sección ${id}`)
  return found
}
const textOf = (blocks: LegalBlock[]) =>
  blocks.map((b) => (b.kind === 'list' ? b.items.join(' | ') : b.text)).join('\n')

describe('Aviso de privacidad: verificación de seguridad de Cloudflare (Turnstile)', () => {
  it('"¿Con quién compartimos?" nombra a Cloudflare Turnstile y dónde aparece (la página de registro)', () => {
    const text = textOf(section('con-quien-compartimos-tus-datos').blocks)

    expect(text).toContain('Cloudflare Turnstile')
    expect(text).toMatch(/página de registro/i)
  })

  it('dice qué datos técnicos recibe: la dirección IP y señales del navegador', () => {
    const text = textOf(section('con-quien-compartimos-tus-datos').blocks)
    const turnstile = text.split(' | ').find((item) => item.includes('Turnstile'))!

    expect(turnstile).toMatch(/dirección IP/i)
    expect(turnstile).toMatch(/señales/i)
    expect(turnstile).toMatch(/navegador/i)
  })

  it('sigue diciendo que el tráfico pasa por Cloudflare', () => {
    const text = textOf(section('con-quien-compartimos-tus-datos').blocks)

    expect(text).toMatch(/Cloudflare entrega el sitio/)
    expect(text).toMatch(/Por su red pasa el tráfico/)
  })

  it('"¿Qué datos recabamos?" lista esos datos técnicos en el bloque del registro', () => {
    const blocks = section('que-datos-recabamos').blocks
    const registro = blocks.findIndex((b) => b.kind === 'h3' && b.text.includes('registro de tu negocio'))
    const list = blocks[registro + 1]

    expect(list.kind).toBe('list')
    const items = (list as Extract<LegalBlock, { kind: 'list' }>).items.join(' | ')
    expect(items).toMatch(/verificación de seguridad/i)
    expect(items).toMatch(/dirección IP/i)
  })

  it('"¿Para qué usamos tus datos?" incluye comprobar que quien se registra es una persona', () => {
    const text = textOf(section('para-que-usamos-tus-datos').blocks)

    expect(text).toMatch(/quien se registra es una persona/i)
  })

  it('no promete lo que no sabemos: no dice que Turnstile no usa cookies ni que no guarda nada', () => {
    const text = textOf(PRIVACY_NOTICE.sections.flatMap((s) => s.blocks))

    expect(text).not.toMatch(/Turnstile[^.]*(no usa|sin) cookies/i)
    expect(text).not.toMatch(/Turnstile[^.]*no guarda/i)
  })
})

describe('versión de los textos legales y constancia del cambio', () => {
  it('LEGAL_VERSION subió a 2026-10-19 (el texto cambió)', () => {
    expect(LEGAL_VERSION).toBe('2026-10-19')
    expect(formatLegalVersionDate(LEGAL_VERSION)).toBe('19 de octubre de 2026')
  })

  it('el historial de cambios empieza por la versión vigente y dice qué cambió', () => {
    expect(LEGAL_CHANGELOG[0].version).toBe(LEGAL_VERSION)
    expect(LEGAL_CHANGELOG[0].summary).toMatch(/Turnstile/)
    expect(LEGAL_CHANGELOG[0].summary).toMatch(/Cloudflare/)
  })

  it('conserva la versión anterior (2026-10-16) como la primera', () => {
    expect(LEGAL_CHANGELOG.at(-1)!.version).toBe('2026-10-16')
  })

  it('las versiones son fechas válidas, sin repetirse y de la más nueva a la más vieja', () => {
    const versions = LEGAL_CHANGELOG.map((entry) => entry.version)

    expect(new Set(versions).size).toBe(versions.length)
    expect(versions.every((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))).toBe(true)
    expect([...versions].sort().reverse()).toEqual(versions)
  })
})
