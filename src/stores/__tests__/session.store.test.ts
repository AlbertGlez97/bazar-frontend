import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../session.store'
import type { Member } from '@/types/member.types'

const socio: Member = { id: 'm-1', name: 'Alberto', role: 'socio', active: true }

const storedDevice = () => JSON.parse(localStorage.getItem('device_context') ?? 'null')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
})

describe('session.store', () => {
  it('arranca sin dispositivo ni persona cuando el storage está vacío', () => {
    const store = useSessionStore()
    expect(store.isDeviceIdentified).toBe(false)
    expect(store.isMemberSelected).toBe(false)
    expect(store.isContextReady).toBe(false)
    expect(store.deviceToken).toBeNull()
  })

  it('setDevice guarda el deviceId en memoria y en localStorage (persiste entre recargas)', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })

    expect(store.deviceId).toBe('d-1')
    expect(store.deviceName).toBe('Shared tablet')
    expect(store.isDeviceIdentified).toBe(true)
    expect(storedDevice()).toEqual({ deviceId: 'd-1', name: 'Shared tablet' })
  })

  it('setDevice con deviceToken lo conserva en memoria y en localStorage', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', name: 'Shared tablet', deviceToken: 'tok-secret' })

    expect(store.deviceToken).toBe('tok-secret')
    expect(storedDevice()).toEqual({ deviceId: 'd-1', name: 'Shared tablet', deviceToken: 'tok-secret' })
  })

  it('setDevice sin token (dispositivo heredado) NO escribe la clave deviceToken', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })

    expect(store.deviceToken).toBeNull()
    expect(storedDevice()).not.toHaveProperty('deviceToken')
  })

  it('el store ya no guarda ni expone el identifier original del dispositivo', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', name: 'Shared tablet', deviceToken: 'tok-secret' })

    expect(store).not.toHaveProperty('deviceIdentifier')
    expect(localStorage.getItem('device_context')).not.toContain('identifier')
  })

  it('restaura el dispositivo (con su token) desde localStorage al crear el store', () => {
    localStorage.setItem('device_context', JSON.stringify({
      deviceId: 'd-2', name: 'Shared tablet', deviceToken: 'tok-2',
    }))
    const store = useSessionStore()
    expect(store.deviceId).toBe('d-2')
    expect(store.deviceName).toBe('Shared tablet')
    expect(store.deviceToken).toBe('tok-2')
    expect(store.isDeviceIdentified).toBe(true)
  })

  describe('migración del valor heredado { deviceId, identifier, name }', () => {
    it('sigue identificado, sin token, y NO se descarta como corrupto', () => {
      localStorage.setItem('device_context', JSON.stringify({
        deviceId: 'd-legacy', identifier: 'shared-tablet', name: 'Shared tablet',
      }))
      const store = useSessionStore()

      expect(store.isDeviceIdentified).toBe(true)
      expect(store.deviceId).toBe('d-legacy')
      expect(store.deviceName).toBe('Shared tablet')
      expect(store.deviceToken).toBeNull()
    })

    it('reescribe el storage sin el identifier', () => {
      localStorage.setItem('device_context', JSON.stringify({
        deviceId: 'd-legacy', identifier: 'shared-tablet', name: 'Shared tablet',
      }))
      useSessionStore()

      expect(storedDevice()).toEqual({ deviceId: 'd-legacy', name: 'Shared tablet' })
      expect(localStorage.getItem('device_context')).not.toContain('shared-tablet')
    })

    it('un valor ya normalizado no se reescribe con otra forma', () => {
      const normalized = JSON.stringify({ deviceId: 'd-1', name: 'Tablet', deviceToken: 'tok' })
      localStorage.setItem('device_context', normalized)
      useSessionStore()

      expect(localStorage.getItem('device_context')).toBe(normalized)
    })
  })

  describe('valores corruptos se descartan', () => {
    it.each([
      ['sin deviceId', { name: 'Tablet' }],
      ['deviceId que no es texto', { deviceId: 42, name: 'Tablet' }],
      ['sin name', { deviceId: 'd-1' }],
      ['name que no es texto', { deviceId: 'd-1', name: 7 }],
      ['deviceToken que no es texto', { deviceId: 'd-1', name: 'Tablet', deviceToken: 123 }],
      ['deviceToken vacío', { deviceId: 'd-1', name: 'Tablet', deviceToken: '' }],
      ['null', null],
      ['un array', ['d-1', 'Tablet']],
      ['un texto suelto', 'd-1'],
    ])('%s', (_label, value) => {
      localStorage.setItem('device_context', JSON.stringify(value))
      const store = useSessionStore()

      expect(store.isDeviceIdentified).toBe(false)
      expect(store.deviceToken).toBeNull()
      expect(localStorage.getItem('device_context')).toBeNull()
    })
  })

  it('setMember guarda la persona en memoria y en sessionStorage, NO en localStorage', () => {
    const store = useSessionStore()
    store.setMember(socio)

    expect(store.memberId).toBe('m-1')
    expect(store.member).toEqual(socio)
    expect(store.isMemberSelected).toBe(true)
    expect(JSON.parse(sessionStorage.getItem('member_context') ?? 'null')).toEqual(socio)
    expect(localStorage.getItem('member_context')).toBeNull()
  })

  it('isContextReady solo es true cuando hay dispositivo Y persona', () => {
    const store = useSessionStore()
    expect(store.isContextReady).toBe(false)

    store.setDevice({ deviceId: 'd-1', name: 'Shared tablet' })
    expect(store.isContextReady).toBe(false)

    store.setMember(socio)
    expect(store.isContextReady).toBe(true)
  })

  it('clearOnLogout limpia la persona pero conserva el dispositivo y su token', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', name: 'Shared tablet', deviceToken: 'tok' })
    store.setMember(socio)

    store.clearOnLogout()

    expect(store.memberId).toBeNull()
    expect(store.member).toBeNull()
    expect(sessionStorage.getItem('member_context')).toBeNull()
    expect(store.deviceId).toBe('d-1')
    expect(store.deviceToken).toBe('tok')
    expect(store.isDeviceIdentified).toBe(true)
  })

  it('clearDevice borra el dispositivo Y su token (para forzar re-identificación manual)', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', name: 'Shared tablet', deviceToken: 'tok' })
    store.clearDevice()

    expect(store.deviceId).toBeNull()
    expect(store.deviceName).toBeNull()
    expect(store.deviceToken).toBeNull()
    expect(localStorage.getItem('device_context')).toBeNull()
  })

  it('reidentificar con un dispositivo heredado descarta el token anterior', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', name: 'Tablet', deviceToken: 'tok-viejo' })
    store.setDevice({ deviceId: 'd-2', name: 'Otra' })

    expect(store.deviceToken).toBeNull()
    expect(storedDevice()).toEqual({ deviceId: 'd-2', name: 'Otra' })
  })

  it('ignora storage corrupto y arranca como si no hubiera contexto', () => {
    localStorage.setItem('device_context', '{not-json')
    sessionStorage.setItem('member_context', '{not-json')

    const store = useSessionStore()

    expect(store.isDeviceIdentified).toBe(false)
    expect(store.isMemberSelected).toBe(false)
  })
})
