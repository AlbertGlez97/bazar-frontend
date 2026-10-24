import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSessionStore } from '../session.store'
const owner = { accountId: 'account-a', apiBase: '/api/v1' }
const member = { id: 'member-a', name: 'Ana', role: 'socio' as const, active: true }
function identity(accountId = 'account-a') {
  localStorage.setItem('access_token', 'a.' + btoa(JSON.stringify({ sub: accountId })) + '.z')
  localStorage.setItem('token_expires_at', String(Date.now() + 60000))
}
function seed() {
  localStorage.setItem('device_context', JSON.stringify({ deviceId: 'device-a', name: 'Tablet', deviceToken: 'secret' }))
  localStorage.setItem('device_context_owner', JSON.stringify(owner))
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActivePinia(createPinia()); identity() })
describe('device ownership', () => {
  it('rejects a different API base for the device', () => {
    seed(); localStorage.setItem('device_context_owner', JSON.stringify({ ...owner, apiBase: '/other' }))
    const session = useSessionStore()
    expect(session.deviceId).toBeNull(); expect(session.memberId).toBeNull()
  })
  it('hides expired identity without deleting the owned device', () => {
    seed(); localStorage.setItem('token_expires_at', '1')
    const session = useSessionStore()
    expect(session.deviceId).toBeNull(); expect(localStorage.getItem('device_context')).not.toBeNull()
  })
  it('restores the matching owned device; the person is not restored, it comes from the account', () => {
    seed()
    const session = useSessionStore()
    expect(session.deviceId).toBe('device-a')
    expect(session.hasPerson).toBe(false)
    expect(session.isContextReady).toBe(false)
    session.setMember(member)
    expect(session.isContextReady).toBe(true)
  })
  it('rejects an unowned legacy device', () => {
    seed(); localStorage.removeItem('device_context_owner')
    const session = useSessionStore()
    expect(session.deviceId).toBeNull(); expect(session.memberId).toBeNull()
    expect(localStorage.getItem('device_context')).toBeNull()
  })
  it('rejects a device from another account or API base', () => {
    seed(); identity('account-b')
    expect(useSessionStore().isContextReady).toBe(false)
    expect(localStorage.getItem('device_context')).toBeNull()
  })
  it('clears the in-memory person when the account owner changes', () => {
    const session = useSessionStore()
    session.setMember(member)
    identity('account-b')
    session.reconcileOwnership()
    expect(session.member).toBeNull(); expect(session.memberId).toBeNull()
  })
  it('does not expose owned device without identity and preserves it for matching login', () => {
    seed(); localStorage.removeItem('access_token')
    expect(useSessionStore().deviceId).toBeNull()
    expect(localStorage.getItem('device_context')).not.toBeNull()
  })
})
