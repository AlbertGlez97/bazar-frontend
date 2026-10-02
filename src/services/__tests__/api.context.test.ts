import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import api from '../api'
import { useSessionStore } from '@/stores/session.store'
const jwt = (sub: string) => 'a.' + btoa(JSON.stringify({ sub })) + '.z'
const request = (config: object) => (api.interceptors.request as unknown as { handlers: { fulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }[] }).handlers[0].fulfilled(config as InternalAxiosRequestConfig)
const reject = (config: object, status = 403, message = 'Selection is not authorized for this context') => (api.interceptors.response as unknown as { handlers: { rejected: (error: AxiosError) => Promise<never> }[] }).handlers[0].rejected({ config, response: { status, data: { message } } } as AxiosError)
beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  localStorage.setItem('access_token', jwt('a'))
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
  const session = useSessionStore()
  session.setDevice({ deviceId: 'da', name: 'Tablet', deviceToken: 'secret' })
  session.setMember({ id: 'ma', name: 'Ana', role: 'socio', active: true })
})
describe('current selection recovery', () => {
  it.each(['/auth/me', '/auth/login', '/devices/identify'])('sends no context on JWT-only %s', (url) => {
    const config = request({ url, headers: {} })
    expect(config.headers['x-member-id']).toBeUndefined()
    expect(config.headers['x-device-id']).toBeUndefined()
    expect(config.headers['x-device-token']).toBeUndefined()
  })
  it('invalidates the current rejected selection but keeps credentials', async () => {
    const config = request({ url: '/products', headers: {} })
    await expect(reject(config)).rejects.toBeDefined()
    expect(useSessionStore().deviceId).toBeNull()
    expect(useSessionStore().memberId).toBeNull()
    expect(useSessionStore().recoveryReason).toBe('rejected')
    expect(localStorage.getItem('access_token')).toBe(jwt('a'))
  })
  it.each(['permission', 'foreign', 'stale'])('does not invalidate for %s response', async (kind) => {
    const config = request({ url: '/products', headers: kind === 'foreign' ? { 'x-member-id': 'other' } : {} })
    if (kind === 'stale') {
      localStorage.setItem('access_token', jwt('b'))
      useSessionStore().reconcileOwnership()
      useSessionStore().setDevice({ deviceId: 'db', name: 'New' })
      useSessionStore().setMember({ id: 'mb', name: 'B', role: 'socio', active: true })
    }
    await expect(reject(config, 403, kind === 'permission' ? 'Only socios can do this' : undefined)).rejects.toBeDefined()
    expect(useSessionStore().deviceId).toBe(kind === 'stale' ? 'db' : 'da')
  })
  it('does not clear newer credentials for a delayed401', async () => {
    const config = request({ url: '/products', headers: {} })
    localStorage.setItem('access_token', jwt('b'))
    await expect(reject(config, 401)).rejects.toBeDefined()
    expect(localStorage.getItem('access_token')).toBe(jwt('b'))
  })
})
