import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../session.store'

// Un navegador, varias cuentas: cada una conserva su propio dispositivo.
const API = '/api/v1'
const login = (accountId: string | null) => {
  if (accountId === null) {
    localStorage.removeItem('access_token')
    return
  }
  localStorage.setItem('access_token', 'a.' + btoa(JSON.stringify({ sub: accountId })) + '.z')
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
}
/** Como cuando alguien cierra sesión y otra persona entra: el almacenamiento sigue, la tienda se rehace. */
const freshStore = () => {
  setActivePinia(createPinia())
  return useSessionStore()
}
const deviceA = { deviceId: 'device-a', name: 'Tablet de la tienda', deviceToken: 'secret-a' }
const deviceB = { deviceId: 'device-b', name: 'Dispositivo de Beto', deviceToken: 'secret-b' }
const stored = () => JSON.parse(localStorage.getItem('device_contexts') ?? 'null')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('un dispositivo por cuenta en el mismo navegador', () => {
  it('cada cuenta guarda el suyo y entrar con la otra no borra el de la primera', () => {
    login('shared')
    freshStore().setDevice(deviceA)

    login('beto')
    const asBeto = freshStore()
    expect(asBeto.isDeviceIdentified).toBe(false)
    // Antes se borraba el de la otra cuenta; ahora solo se ve que esta no tiene.
    expect(asBeto.recoveryReason).toBeNull()
    asBeto.setDevice(deviceB)

    login('shared')
    const backToShared = freshStore()
    expect(backToShared.deviceId).toBe('device-a')
    expect(backToShared.deviceToken).toBe('secret-a')
    expect(backToShared.deviceName).toBe('Tablet de la tienda')

    login('beto')
    const backToBeto = freshStore()
    expect(backToBeto.deviceId).toBe('device-b')
    expect(backToBeto.deviceToken).toBe('secret-b')
  })

  it('cambiar de cuenta muchas veces seguidas no pierde ni mezcla ningún dispositivo', () => {
    login('shared'); freshStore().setDevice(deviceA)
    login('beto'); freshStore().setDevice(deviceB)
    for (let round = 0; round < 6; round++) {
      login('shared')
      const s = freshStore()
      expect([s.deviceId, s.deviceToken]).toEqual(['device-a', 'secret-a'])
      login('beto')
      const b = freshStore()
      expect([b.deviceId, b.deviceToken]).toEqual(['device-b', 'secret-b'])
      login('nueva-cuenta')
      expect(freshStore().isDeviceIdentified).toBe(false)
    }
    expect(Object.keys(stored().devices)).toHaveLength(2)
  })

  it('con la misma tienda en memoria, cambiar el token de acceso también cambia de dispositivo', () => {
    login('shared')
    const session = freshStore()
    session.setDevice(deviceA)
    login('beto')
    session.reconcileOwnership()
    expect(session.deviceId).toBeNull()
    session.setDevice(deviceB)
    login('shared')
    session.reconcileOwnership()
    expect(session.deviceId).toBe('device-a')
  })

  it('cerrar sesión no borra ningún dispositivo y nadie lo ve sin sesión', () => {
    login('shared'); const s = freshStore(); s.setDevice(deviceA)
    s.clearOnLogout()
    expect(s.deviceId).toBeNull()
    login(null)
    expect(freshStore().deviceId).toBeNull()
    expect(stored().devices).toHaveProperty(`shared|${API}`)
  })

  it('quitar el dispositivo de una cuenta no toca el de otra', () => {
    login('shared'); freshStore().setDevice(deviceA)
    login('beto'); const beto = freshStore(); beto.setDevice(deviceB)
    beto.clearDevice()
    expect(beto.deviceId).toBeNull()
    login('shared')
    expect(freshStore().deviceId).toBe('device-a')
  })

  it('el mismo identificador de cuenta en otra API no comparte dispositivo', () => {
    login('shared'); freshStore().setDevice(deviceA)
    const blob = stored()
    blob.devices['shared|/otra-api'] = { deviceId: 'device-x', name: 'Otro' }
    localStorage.setItem('device_contexts', JSON.stringify(blob))
    expect(freshStore().deviceId).toBe('device-a')
  })

  it('no guarda el identificador de un solo uso, solo id, nombre y token', () => {
    login('shared')
    freshStore().setDevice({ ...deviceA, identifier: 'ya-usado' } as never)
    expect(stored().devices[`shared|${API}`]).toEqual(deviceA)
  })
})

describe('migración de la clave anterior (un solo dispositivo)', () => {
  const owner = (accountId: string) => ({ accountId, apiBase: API })
  const seedOld = (accountId: string | null, device = deviceA) => {
    localStorage.setItem('device_context', JSON.stringify(device))
    if (accountId) localStorage.setItem('device_context_owner', JSON.stringify(owner(accountId)))
  }

  it('el dispositivo guardado de la cuenta que entra sigue ahí, sin volver a identificarlo', () => {
    seedOld('shared')
    login('shared')
    const s = freshStore()
    expect(s.isDeviceIdentified).toBe(true)
    expect([s.deviceId, s.deviceToken, s.deviceName]).toEqual(['device-a', 'secret-a', 'Tablet de la tienda'])
    expect(localStorage.getItem('device_context')).toBeNull()
    expect(localStorage.getItem('device_context_owner')).toBeNull()
    expect(stored().devices[`shared|${API}`]).toEqual(deviceA)
  })

  it('si entra OTRA cuenta, el dispositivo de la anterior se conserva a su nombre, no se borra', () => {
    seedOld('shared')
    login('beto')
    const beto = freshStore()
    expect(beto.isDeviceIdentified).toBe(false)
    expect(beto.recoveryReason).toBeNull()
    login('shared')
    expect(freshStore().deviceId).toBe('device-a')
  })

  it('un dispositivo heredado sin token se migra igual, sin inventarle uno', () => {
    seedOld('shared', { deviceId: 'device-old', name: 'Principal' } as never)
    login('shared')
    const s = freshStore()
    expect(s.deviceId).toBe('device-old')
    expect(s.deviceToken).toBeNull()
  })

  it('el formato más viejo, con identificador, se migra soltándolo', () => {
    seedOld('shared', { deviceId: 'device-old', identifier: 'ya-usado', name: 'Principal' } as never)
    login('shared')
    freshStore()
    expect(stored().devices[`shared|${API}`]).toEqual({ deviceId: 'device-old', name: 'Principal' })
  })

  it('sin dueño conocido no se puede atribuir: se descarta como antes y se avisa', () => {
    seedOld(null)
    login('shared')
    const s = freshStore()
    expect(s.isDeviceIdentified).toBe(false)
    expect(s.recoveryReason).toBe('legacy')
    expect(localStorage.getItem('device_context')).toBeNull()
  })

  it('migrar no pisa un dispositivo que esa cuenta ya tenía en la clave nueva', () => {
    login('shared'); freshStore().setDevice(deviceB)
    seedOld('shared', deviceA)
    login('shared')
    expect(freshStore().deviceId).toBe('device-b')
  })

  it('sin sesión no se migra nada todavía', () => {
    seedOld('shared')
    login(null)
    freshStore()
    expect(localStorage.getItem('device_context')).not.toBeNull()
  })
})

describe('dispositivo que llega de la invitación (saveDeviceForAccount)', () => {
  it('queda atado a la cuenta nueva sin sesión abierta, y esa cuenta lo encuentra al entrar', () => {
    login('shared'); freshStore().setDevice(deviceA)
    login(null)
    const s = freshStore()
    s.saveDeviceForAccount('beto', deviceB)

    login('beto')
    const beto = freshStore()
    expect([beto.deviceId, beto.deviceName, beto.deviceToken]).toEqual(['device-b', 'Dispositivo de Beto', 'secret-b'])
    login('shared')
    expect(freshStore().deviceId).toBe('device-a')
  })

  it('no activa el dispositivo en la sesión actual de otra cuenta', () => {
    login('shared')
    const s = freshStore()
    s.saveDeviceForAccount('beto', deviceB)
    expect(s.deviceId).toBeNull()
  })

  it('normaliza lo que guarda: sin identificador', () => {
    freshStore().saveDeviceForAccount('beto', { ...deviceB, identifier: 'ya-usado' } as never)
    expect(stored().devices[`beto|${API}`]).toEqual(deviceB)
  })

  it('rechaza datos inválidos sin guardar nada', () => {
    const s = freshStore()
    s.saveDeviceForAccount('', deviceB)
    s.saveDeviceForAccount('beto', { deviceId: '', name: 'x' } as never)
    s.saveDeviceForAccount('beto', { deviceId: 'd', name: 'x', deviceToken: '' } as never)
    expect(localStorage.getItem('device_contexts')).toBeNull()
  })
})

describe('almacenamiento dañado', () => {
  it.each([
    ['no es JSON', '{{{'],
    ['no es un objeto', '[]'],
    ['sin lista de dispositivos', '{"version":1}'],
    ['otra versión', '{"version":99,"devices":{"shared|/api/v1":{"deviceId":"d","name":"n"}}}'],
  ])('%s: se trata como sin dispositivo y no rompe', (_name, raw) => {
    localStorage.setItem('device_contexts', raw)
    login('shared')
    expect(freshStore().isDeviceIdentified).toBe(false)
  })

  it('una entrada dañada no estorba a las demás', () => {
    localStorage.setItem('device_contexts', JSON.stringify({
      version: 1,
      devices: { [`shared|${API}`]: { deviceId: 7 }, [`beto|${API}`]: deviceB },
    }))
    login('shared')
    expect(freshStore().isDeviceIdentified).toBe(false)
    login('beto')
    expect(freshStore().deviceId).toBe('device-b')
  })

  it('al guardar sobre un almacenamiento dañado, lo reemplaza por uno sano', () => {
    localStorage.setItem('device_contexts', '{{{')
    login('shared')
    freshStore().setDevice(deviceA)
    expect(stored()).toEqual({ version: 1, devices: { [`shared|${API}`]: deviceA } })
  })
})
