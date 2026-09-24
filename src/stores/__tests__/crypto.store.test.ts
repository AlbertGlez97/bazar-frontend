// Tests del CryptoStore — cubre el ciclo de vida con Recovery Phrase:
// initSession (genera DEK + phrase + doble wrap), recoverWithPhrase, y
// rotatePasswordAfterRecovery. Usa WebCrypto real (disponible en Node 19+).
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCryptoStore } from '@/stores/crypto.store'
import CryptoService from '@/services/crypto.service'

const USER_ID = 'user-test-1'

describe('useCryptoStore — initSession con Recovery Phrase', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('devuelve phrase + ambos salts + ambos wrappedDEKs', async () => {
    const store = useCryptoStore()
    const result = await store.initSession('miContraseña123!', USER_ID)

    expect(result.recoveryPhrase).toHaveLength(12)
    expect(result.saltPassword).toBeTruthy()
    expect(result.saltRecovery).toBeTruthy()
    expect(result.wrappedDekPassword).toHaveProperty('iv')
    expect(result.wrappedDekPassword).toHaveProperty('ct')
    expect(result.wrappedDekRecovery).toHaveProperty('iv')
    expect(result.wrappedDekRecovery).toHaveProperty('ct')
  })

  it('los dos salts son distintos entre sí (camino password ≠ camino recovery)', async () => {
    const store = useCryptoStore()
    const { saltPassword, saltRecovery } = await store.initSession('pwd', USER_ID)
    expect(saltPassword).not.toBe(saltRecovery)
  })

  it('la phrase generada es válida BIP39', async () => {
    const store = useCryptoStore()
    const { recoveryPhrase } = await store.initSession('pwd', USER_ID)
    expect(CryptoService.validateRecoveryPhrase(recoveryPhrase)).toBe(true)
  })

  it('marca isReady=true y mantiene la DEK en RAM tras init', async () => {
    const store = useCryptoStore()
    await store.initSession('pwd', USER_ID)
    expect(store.isReady).toBe(true)

    // Podemos cifrar inmediatamente (la DEK está en _dek)
    const payload = await store.encrypt({ test: 123 })
    const decoded = await store.decrypt<{ test: number }>(payload)
    expect(decoded.test).toBe(123)
  })

  it('persiste saltPassword + wrappedDekPassword en localStorage (cache)', async () => {
    const store = useCryptoStore()
    const result = await store.initSession('pwd', USER_ID)

    expect(localStorage.getItem(`e2ee_salt_${USER_ID}`)).toBe(result.saltPassword)
    const cached = JSON.parse(localStorage.getItem(`e2ee_wdek_${USER_ID}`)!)
    expect(cached).toEqual(result.wrappedDekPassword)
  })

  it('NO persiste material de recovery en localStorage (por diseño)', async () => {
    const store = useCryptoStore()
    const result = await store.initSession('pwd', USER_ID)

    // Buscamos en todo localStorage que no aparezca el salt/wdek de recovery
    const allValues = Object.keys(localStorage).map(k => localStorage.getItem(k)).join('|')
    expect(allValues).not.toContain(result.saltRecovery)
    expect(allValues).not.toContain(result.wrappedDekRecovery.ct)
  })

  it('dos llamadas consecutivas generan phrases distintas (entropía real)', async () => {
    const store = useCryptoStore()
    const a = await store.initSession('pwd', 'user-a')
    const b = await store.initSession('pwd', 'user-b')
    expect(a.recoveryPhrase.join(' ')).not.toBe(b.recoveryPhrase.join(' '))
  })
})

describe('useCryptoStore — recoverWithPhrase', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('con la phrase correcta recupera la DEK y deja isReady=true', async () => {
    const store = useCryptoStore()
    const { recoveryPhrase, saltRecovery, wrappedDekRecovery } =
      await store.initSession('pwd-original', USER_ID)

    // Ciframos algo con la DEK original
    const payload = await store.encrypt({ saldo: 7777 })

    // "Olvido" la sesión (simula cambio de dispositivo)
    store.clearSession()
    expect(store.isReady).toBe(false)

    // Recupero con la phrase (saltRecovery + wrappedDekRecovery vendrían del backend)
    await store.recoverWithPhrase(recoveryPhrase, saltRecovery, wrappedDekRecovery)
    expect(store.isReady).toBe(true)

    // La DEK restaurada desencripta datos cifrados con la DEK original
    const decoded = await store.decrypt<{ saldo: number }>(payload)
    expect(decoded.saldo).toBe(7777)
  })

  it('acepta la phrase como string crudo (user pega del PDF con formato)', async () => {
    const store = useCryptoStore()
    const { recoveryPhrase, saltRecovery, wrappedDekRecovery } =
      await store.initSession('pwd', USER_ID)

    store.clearSession()

    // Simula un copy-paste desordenado: mayúsculas, tabs, newlines
    const messyInput = '  ' + recoveryPhrase.join('\t\n ').toUpperCase() + '   '
    await store.recoverWithPhrase(messyInput, saltRecovery, wrappedDekRecovery)
    expect(store.isReady).toBe(true)
  })

  it('rechaza frase que no pasa validación BIP39 (palabras inventadas)', async () => {
    const store = useCryptoStore()
    const { saltRecovery, wrappedDekRecovery } = await store.initSession('pwd', USER_ID)
    store.clearSession()

    const fakePhrase = new Array(12).fill('zzzinventada')
    await expect(
      store.recoverWithPhrase(fakePhrase, saltRecovery, wrappedDekRecovery)
    ).rejects.toThrow()
    expect(store.isReady).toBe(false)
  })

  it('rechaza frase válida BIP39 pero NO la de esta cuenta (DOMException)', async () => {
    const store = useCryptoStore()
    const { saltRecovery, wrappedDekRecovery } = await store.initSession('pwd', USER_ID)
    store.clearSession()

    const otraPhrase = CryptoService.generateRecoveryPhrase()
    await expect(
      store.recoverWithPhrase(otraPhrase, saltRecovery, wrappedDekRecovery)
    ).rejects.toThrow()
    expect(store.isReady).toBe(false)
  })

  it('tras fallo, la DEK queda null (no hay estado corrupto)', async () => {
    const store = useCryptoStore()
    const { saltRecovery, wrappedDekRecovery } = await store.initSession('pwd', USER_ID)
    store.clearSession()

    try {
      await store.recoverWithPhrase(['a'], saltRecovery, wrappedDekRecovery)
    } catch {/* esperado */}

    expect(store.isReady).toBe(false)
    // Intentar cifrar sin DEK debe lanzar el guard
    await expect(store.encrypt({ x: 1 })).rejects.toThrow(/DEK no disponible/)
  })
})

describe('useCryptoStore — rotatePasswordAfterRecovery', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('genera nuevo saltPassword + wrappedDekPassword con la DEK actual', async () => {
    const store = useCryptoStore()
    const initial = await store.initSession('pwd-vieja', USER_ID)
    const payload = await store.encrypt({ monto: 42 })

    // Simular recovery (DEK ya en RAM tras initSession, no hace falta recoverWithPhrase acá)
    const result = await store.rotatePasswordAfterRecovery('pwd-nueva', USER_ID)

    // El salt y el wrapped DEK deben ser nuevos (no idénticos al de initSession)
    expect(result.saltPassword).not.toBe(initial.saltPassword)
    expect(result.wrappedDekPassword.ct).not.toBe(initial.wrappedDekPassword.ct)

    // El nuevo wrappedDek desempaca a una DEK que descifra los datos originales
    const kekNueva   = await CryptoService.deriveKEK('pwd-nueva', result.saltPassword)
    const dekNueva   = await CryptoService.unwrapDEK(result.wrappedDekPassword, kekNueva)
    const clear      = await CryptoService.decrypt<{ monto: number }>(dekNueva, payload)
    expect(clear.monto).toBe(42)
  })

  it('actualiza el cache de localStorage con los nuevos valores', async () => {
    const store = useCryptoStore()
    await store.initSession('pwd-vieja', USER_ID)

    const result = await store.rotatePasswordAfterRecovery('pwd-nueva', USER_ID)

    expect(localStorage.getItem(`e2ee_salt_${USER_ID}`)).toBe(result.saltPassword)
    const cached = JSON.parse(localStorage.getItem(`e2ee_wdek_${USER_ID}`)!)
    expect(cached).toEqual(result.wrappedDekPassword)
  })

  it('lanza si no hay DEK en RAM (contrato de pre-requisito)', async () => {
    const store = useCryptoStore()
    // Sin initSession ni recoverWithPhrase previo → DEK no disponible
    await expect(
      store.rotatePasswordAfterRecovery('pwd-nueva', USER_ID)
    ).rejects.toThrow(/DEK no disponible/)
  })

  it('la contraseña vieja ya NO desempaca el nuevo wrappedDek', async () => {
    const store = useCryptoStore()
    await store.initSession('pwd-vieja', USER_ID)

    const { saltPassword, wrappedDekPassword } =
      await store.rotatePasswordAfterRecovery('pwd-nueva', USER_ID)

    const kekVieja = await CryptoService.deriveKEK('pwd-vieja', saltPassword)
    await expect(
      CryptoService.unwrapDEK(wrappedDekPassword, kekVieja)
    ).rejects.toThrow()
  })
})
