// Tests de CryptoService — cubre la API nueva de Recovery Phrase (BIP39 español)
// y la integración con el flujo de key wrapping existente.
import { describe, it, expect } from 'vitest'
import CryptoService from '@/services/crypto.service'
import { wordlist as spanishWordlist } from '@scure/bip39/wordlists/spanish.js'

describe('CryptoService — Recovery Phrase', () => {
  describe('generateRecoveryPhrase', () => {
    it('devuelve exactamente 12 palabras', () => {
      const phrase = CryptoService.generateRecoveryPhrase()
      expect(phrase).toHaveLength(12)
    })

    it('todas las palabras pertenecen al wordlist español oficial BIP39', () => {
      const phrase = CryptoService.generateRecoveryPhrase()
      phrase.forEach(word => {
        expect(spanishWordlist).toContain(word)
      })
    })

    it('la frase generada pasa su propio checksum (BIP39 válido)', () => {
      const phrase = CryptoService.generateRecoveryPhrase()
      expect(CryptoService.validateRecoveryPhrase(phrase)).toBe(true)
    })

    it('genera frases distintas en llamadas sucesivas (entropía real)', () => {
      const a = CryptoService.generateRecoveryPhrase()
      const b = CryptoService.generateRecoveryPhrase()
      expect(a.join(' ')).not.toBe(b.join(' '))
    })
  })

  describe('normalizeRecoveryPhrase', () => {
    it('elimina espacios al inicio y fin', () => {
      const input = '  ábaco corazón  '
      expect(CryptoService.normalizeRecoveryPhrase(input))
        .toEqual(['ábaco', 'corazón'].map(w => w.normalize('NFKD')))
    })

    it('convierte a minúsculas', () => {
      const input = 'ÁBACO Corazón'
      expect(CryptoService.normalizeRecoveryPhrase(input))
        .toEqual(['ábaco', 'corazón'].map(w => w.normalize('NFKD')))
    })

    it('colapsa múltiples whitespace (tabs, newlines, espacios múltiples)', () => {
      const input = 'ábaco   \t\n  corazón'
      expect(CryptoService.normalizeRecoveryPhrase(input))
        .toEqual(['ábaco', 'corazón'].map(w => w.normalize('NFKD')))
    })

    it('normaliza Unicode a NFKD (forma canónica BIP39)', () => {
      // "á" precompuesto (U+00E1) vs "á" descompuesto (a + U+0301).
      // BIP39 usa NFKD: ambas entradas deben quedar descompuestas.
      const precompuesto = '\u00e1baco'
      const descompuesto = 'a\u0301baco'
      const [normA] = CryptoService.normalizeRecoveryPhrase(precompuesto)
      const [normB] = CryptoService.normalizeRecoveryPhrase(descompuesto)
      expect(normA).toBe(normB)
      // La forma canónica es descompuesta (NFKD) — 6 codepoints, no 5
      expect(normA).toBe('a\u0301baco')
      expect(normA.length).toBe(6)
    })

    it('filtra strings vacíos cuando el input tiene espacios redundantes', () => {
      const input = 'ábaco      corazón'
      const result = CryptoService.normalizeRecoveryPhrase(input)
      expect(result).toHaveLength(2)
      expect(result.every(w => w.length > 0)).toBe(true)
    })
  })

  describe('validateRecoveryPhrase', () => {
    it('rechaza frases con cantidad incorrecta de palabras', () => {
      expect(CryptoService.validateRecoveryPhrase([])).toBe(false)
      expect(CryptoService.validateRecoveryPhrase(['ábaco'])).toBe(false)
      expect(CryptoService.validateRecoveryPhrase(new Array(11).fill('ábaco'))).toBe(false)
      expect(CryptoService.validateRecoveryPhrase(new Array(13).fill('ábaco'))).toBe(false)
    })

    it('rechaza frases con palabras que NO están en el wordlist', () => {
      const phrase = CryptoService.generateRecoveryPhrase()
      phrase[0] = 'ZZZPALABRAINVENTADA'
      expect(CryptoService.validateRecoveryPhrase(phrase)).toBe(false)
    })

    it('rechaza una frase con checksum BIP39 inválido', () => {
      // Tomamos 12 palabras válidas del wordlist pero combinadas mal → checksum inválido
      const invalidCombo = [
        'ábaco', 'ábaco', 'ábaco', 'ábaco', 'ábaco', 'ábaco',
        'ábaco', 'ábaco', 'ábaco', 'ábaco', 'ábaco', 'ábaco',
      ]
      expect(CryptoService.validateRecoveryPhrase(invalidCombo)).toBe(false)
    })

    it('acepta una frase generada por generateRecoveryPhrase', () => {
      const phrase = CryptoService.generateRecoveryPhrase()
      expect(CryptoService.validateRecoveryPhrase(phrase)).toBe(true)
    })
  })

  describe('deriveKEKFromPhrase + wrapDEK/unwrapDEK (round-trip)', () => {
    it('con la misma phrase y salt, derivá la misma KEK (determinístico)', async () => {
      const phrase = CryptoService.generateRecoveryPhrase()
      const salt   = CryptoService.generateSalt()
      const dek    = await CryptoService.generateDEK()

      // Envuelvo con KEK_A derivada de la phrase
      const kekA     = await CryptoService.deriveKEKFromPhrase(phrase, salt)
      const wrapped  = await CryptoService.wrapDEK(dek, kekA)

      // Recalculo KEK_B desde cero con misma phrase + salt → debe ser equivalente
      const kekB       = await CryptoService.deriveKEKFromPhrase(phrase, salt)
      const unwrappedB = await CryptoService.unwrapDEK(wrapped, kekB)

      // Pruebo que ambas DEKs son funcionalmente la misma cifrando/descifrando
      const payload = await CryptoService.encrypt(dek, { monto: 5000 })
      const clear   = await CryptoService.decrypt<{ monto: number }>(unwrappedB, payload)
      expect(clear.monto).toBe(5000)
    })

    it('frase distinta = no puede desenvolver (falla con DOMException)', async () => {
      const phraseA = CryptoService.generateRecoveryPhrase()
      const phraseB = CryptoService.generateRecoveryPhrase()
      const salt    = CryptoService.generateSalt()
      const dek     = await CryptoService.generateDEK()

      const kekA    = await CryptoService.deriveKEKFromPhrase(phraseA, salt)
      const wrapped = await CryptoService.wrapDEK(dek, kekA)

      const kekB = await CryptoService.deriveKEKFromPhrase(phraseB, salt)
      await expect(CryptoService.unwrapDEK(wrapped, kekB)).rejects.toThrow()
    })

    it('salt distinto con misma phrase = no puede desenvolver', async () => {
      const phrase = CryptoService.generateRecoveryPhrase()
      const saltA  = CryptoService.generateSalt()
      const saltB  = CryptoService.generateSalt()
      const dek    = await CryptoService.generateDEK()

      const kekA    = await CryptoService.deriveKEKFromPhrase(phrase, saltA)
      const wrapped = await CryptoService.wrapDEK(dek, kekA)

      const kekB = await CryptoService.deriveKEKFromPhrase(phrase, saltB)
      await expect(CryptoService.unwrapDEK(wrapped, kekB)).rejects.toThrow()
    })
  })

  describe('doble wrap (escenario de cuenta nueva con phrase + password)', () => {
    it('la DEK puede desempacarse por ambos caminos independientemente', async () => {
      // Simula el flujo de initSession: genera DEK + wrappea por phrase y por password
      const password = 'miContraseña123!'
      const phrase   = CryptoService.generateRecoveryPhrase()
      const saltPwd  = CryptoService.generateSalt()
      const saltRec  = CryptoService.generateSalt()
      const dek      = await CryptoService.generateDEK()

      const [kekPwd, kekRec] = await Promise.all([
        CryptoService.deriveKEK(password, saltPwd),
        CryptoService.deriveKEKFromPhrase(phrase, saltRec),
      ])

      const [wrappedByPwd, wrappedByRec] = await Promise.all([
        CryptoService.wrapDEK(dek, kekPwd),
        CryptoService.wrapDEK(dek, kekRec),
      ])

      // Ciframos algo con la DEK original
      const payload = await CryptoService.encrypt(dek, { saldo: 20000 })

      // Camino 1: desenvuelvo con password → descifro
      const kekPwd2       = await CryptoService.deriveKEK(password, saltPwd)
      const dekFromPwd    = await CryptoService.unwrapDEK(wrappedByPwd, kekPwd2)
      const clearViaPwd   = await CryptoService.decrypt<{ saldo: number }>(dekFromPwd, payload)
      expect(clearViaPwd.saldo).toBe(20000)

      // Camino 2: desenvuelvo con phrase → descifro
      const kekRec2       = await CryptoService.deriveKEKFromPhrase(phrase, saltRec)
      const dekFromRec    = await CryptoService.unwrapDEK(wrappedByRec, kekRec2)
      const clearViaRec   = await CryptoService.decrypt<{ saldo: number }>(dekFromRec, payload)
      expect(clearViaRec.saldo).toBe(20000)
    })
  })
})
