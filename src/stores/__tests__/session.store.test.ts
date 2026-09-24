import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../session.store'
import type { Member } from '@/types/member.types'

const socio: Member = { id: 'm-1', name: 'Alberto', role: 'socio', active: true }

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
  })

  it('setDevice guarda el deviceId en memoria y en localStorage (persiste entre recargas)', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet' })

    expect(store.deviceId).toBe('d-1')
    expect(store.isDeviceIdentified).toBe(true)
    expect(JSON.parse(localStorage.getItem('device_context') ?? 'null')).toEqual({
      deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet',
    })
  })

  it('restaura el dispositivo ya identificado desde localStorage al crear el store', () => {
    localStorage.setItem('device_context', JSON.stringify({
      deviceId: 'd-2', identifier: 'shared-tablet', name: 'Shared tablet',
    }))
    const store = useSessionStore()
    expect(store.deviceId).toBe('d-2')
    expect(store.isDeviceIdentified).toBe(true)
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

    store.setDevice({ deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet' })
    expect(store.isContextReady).toBe(false)

    store.setMember(socio)
    expect(store.isContextReady).toBe(true)
  })

  it('clearOnLogout limpia la persona pero conserva el dispositivo identificado', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet' })
    store.setMember(socio)

    store.clearOnLogout()

    expect(store.memberId).toBeNull()
    expect(store.member).toBeNull()
    expect(sessionStorage.getItem('member_context')).toBeNull()
    expect(store.deviceId).toBe('d-1')
    expect(store.isDeviceIdentified).toBe(true)
  })

  it('clearDevice borra el dispositivo identificado (para forzar re-identificación manual)', () => {
    const store = useSessionStore()
    store.setDevice({ deviceId: 'd-1', identifier: 'shared-tablet', name: 'Shared tablet' })
    store.clearDevice()

    expect(store.deviceId).toBeNull()
    expect(localStorage.getItem('device_context')).toBeNull()
  })

  it('ignora storage corrupto y arranca como si no hubiera contexto', () => {
    localStorage.setItem('device_context', '{not-json')
    sessionStorage.setItem('member_context', '{not-json')

    const store = useSessionStore()

    expect(store.isDeviceIdentified).toBe(false)
    expect(store.isMemberSelected).toBe(false)
  })
})
