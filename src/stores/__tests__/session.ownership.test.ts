import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../session.store'
const owner = { accountId: 'account-a', apiBase: '/api/v1' }
const member = { id: 'member-a', name: 'Ana', role: 'socio', active: true }
function identity(accountId = 'account-a') {
  localStorage.setItem('access_token', 'a.' + btoa(JSON.stringify({ sub: accountId })) + '.z')
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
}
function seed() {
  localStorage.setItem('device_context', JSON.stringify({ deviceId: 'device-a', name: 'Tablet', deviceToken: 'secret' }))
  localStorage.setItem('device_context_owner', JSON.stringify(owner))
  sessionStorage.setItem('member_context', JSON.stringify(member))
  sessionStorage.setItem('member_context_owner', JSON.stringify(owner))
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia()); identity() })
describe('selection ownership', () => {
  it('rejects a different API base independently of a matching member', () => {
    seed(); localStorage.setItem('device_context_owner', JSON.stringify({ ...owner, apiBase: '/other' }))
    const session = useSessionStore()
    expect(session.deviceId).toBeNull(); expect(session.memberId).toBe('member-a')
  })
  it('hides expired identity without deleting the owned device', () => {
    seed(); localStorage.setItem('token_expires_at', '1')
    const session = useSessionStore()
    expect(session.deviceId).toBeNull(); expect(localStorage.getItem('device_context')).not.toBeNull()
  })
  it('restores matching owned selections without changing persisted payloads', () => {
    seed(); expect(useSessionStore().isContextReady).toBe(true)
  })
  it('rejects an unowned legacy device but keeps a matching member', () => {
    seed(); localStorage.removeItem('device_context_owner')
    const session = useSessionStore()
    expect(session.deviceId).toBeNull(); expect(session.memberId).toBe('member-a')
    expect(localStorage.getItem('device_context')).toBeNull()
  })
  it('rejects only a foreign member while preserving the owned device', () => {
    seed(); sessionStorage.setItem('member_context_owner', JSON.stringify({ ...owner, accountId: 'other' }))
    const session = useSessionStore()
    expect(session.memberId).toBeNull(); expect(session.deviceId).toBe('device-a')
  })
  it('rejects device and member from another account or API base', () => {
    seed(); identity('account-b')
    expect(useSessionStore().isContextReady).toBe(false)
    expect(localStorage.getItem('device_context')).toBeNull()
    expect(sessionStorage.getItem('member_context')).toBeNull()
  })
  it('does not expose owned device without identity and preserves it for matching login', () => {
    seed(); localStorage.removeItem('access_token')
    expect(useSessionStore().deviceId).toBeNull()
    expect(localStorage.getItem('device_context')).not.toBeNull()
  })
})
