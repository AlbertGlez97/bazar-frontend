import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import api from '../api'
import { useSessionStore } from '@/stores/session.store'
import { currentQueueOrigin, canSendDebt } from '../queue-origin'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  localStorage.setItem('access_token', 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z')
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
  const session = useSessionStore()
  session.setDevice({ deviceId: 'device-a', name: 'Tablet', deviceToken: 'secret-device-token' })
  session.setMember({ id: 'member-a', name: 'Ana', role: 'socio', active: true })
})

describe('debt queue routing identity', () => {
  it('captures only non-secret origin fields and permits a new attending member on the same account', () => {
    const origin = currentQueueOrigin()!
    expect(origin).toEqual({ accountId: 'account-a', memberId: 'member-a', deviceId: 'device-a', apiBase: api.defaults.baseURL })
    useSessionStore().setMember({ id: 'member-b', name: 'Beto', role: 'socio', active: true })
    expect(canSendDebt(origin)).toBe(true)
  })
  it('blocks a different device and API base, preserving the original origin', () => {
    const origin = currentQueueOrigin()!
    expect(canSendDebt({ ...origin, deviceId: 'other-device' })).toBe(false)
    expect(canSendDebt({ ...origin, apiBase: '/other-api' })).toBe(false)
    expect(origin.deviceId).toBe('device-a')
  })
  it('cannot derive origin from missing, malformed or subject-less credentials', () => {
    for (const token of ['', 'not-a-jwt', 'a.' + btoa('{}') + '.z']) {
      localStorage.setItem('access_token', token)
      expect(currentQueueOrigin()).toBeNull()
    }
  })
})
