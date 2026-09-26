// Security regression: for an account bound to a member the person selector
// must not exist at all. Only the shared business login (no bound member) picks
// who is attending.
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelectContextView from '../SelectContextView.vue'
import DevicesService from '@/services/devices.service'
import MembersService from '@/services/members.service'
import AuthService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import type { Member } from '@/types/member.types'

vi.mock('@/services/devices.service', () => ({ default: { identify: vi.fn() } }))
vi.mock('@/services/members.service', () => ({ default: { list: vi.fn() } }))
vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const socio: Member = { id: 'm-soc', name: 'Alberto', role: 'socio', active: true }
const colaborador: Member = { id: 'm-col', name: 'Carla', role: 'colaborador', active: true }
const everyone = [socio, colaborador]

async function signInAs(member: Member | null, opts: { deviceIdentified?: boolean } = {}) {
  localStorage.setItem('access_token', 'jwt')
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
  localStorage.setItem('auth_username', 'x')
  if (opts.deviceIdentified) {
    localStorage.setItem('device_context', JSON.stringify({ deviceId: 'd-1', name: 'Shared tablet' }))
  }
  setActivePinia(createPinia())
  vi.mocked(AuthService.me).mockResolvedValue(
    member ? { username: 'x', memberId: member.id, member } : { username: 'x', memberId: null, member: null },
  )
  await useAuthStore().ensureBinding()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(MembersService.list).mockResolvedValue(everyone)
})

describe('SelectContextView with an account bound to a member', () => {
  it('device already identified: NO selector, no members request, straight into the app', async () => {
    await signInAs(colaborador, { deviceIdentified: true })

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Alberto')
    expect(MembersService.list).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'AppHome' })
    expect(useSessionStore().member).toEqual(colaborador)
  })

  it('device not identified yet: asks only for the device, and after it goes into the app WITHOUT a selector', async () => {
    await signInAs(colaborador)
    vi.mocked(DevicesService.identify).mockResolvedValue({ deviceId: 'd-9', deviceToken: 'tok' })

    const wrapper = mount(SelectContextView)
    expect(wrapper.find('form').exists()).toBe(true)

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('codigo')
    await inputs[1].setValue('Tablet')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(MembersService.list).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'AppHome' })
    // The person stays exactly who the server says.
    expect(useSessionStore().member).toEqual(colaborador)
    expect(useSessionStore().deviceId).toBe('d-9')
  })

  it('a bound socio is handled the same way (no selector, socio role from the server)', async () => {
    await signInAs(socio, { deviceIdentified: true })

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(useSessionStore().member?.role).toBe('socio')
    expect(push).toHaveBeenCalledWith({ name: 'AppHome' })
  })

  it('a deactivated bound member sees a clear message, no selector and no way into the app', async () => {
    await signInAs({ ...colaborador, active: false }, { deviceIdentified: true })

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(wrapper.text()).toContain('Tu acceso está desactivado')
    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(MembersService.list).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalledWith({ name: 'AppHome' })
    expect(useSessionStore().member).toBeNull()
  })

  it('the deactivated screen offers to sign out, which clears the session and goes to login', async () => {
    await signInAs({ ...colaborador, active: false }, { deviceIdentified: true })

    const wrapper = mount(SelectContextView)
    await flushPromises()
    const button = wrapper.findAll('button').find((b) => b.text().includes('Cerrar sesión'))
    expect(button).toBeDefined()
    await button!.trigger('click')

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'Login' })
  })
})

describe('SelectContextView with the shared business login', () => {
  it('still shows the selector with everybody and lets the person choose (legacy flow untouched)', async () => {
    await signInAs(null, { deviceIdentified: true })

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(MembersService.list).toHaveBeenCalledOnce()
    const cards = wrapper.findAll('[role="listitem"]')
    expect(cards).toHaveLength(2)

    await cards[0].trigger('click')
    expect(useSessionStore().member).toEqual(socio)
    expect(push).toHaveBeenCalledWith({ name: 'AppHome' })
  })

  it('an unknown binding (server unreachable at startup) behaves as before: the selector is shown', async () => {
    localStorage.setItem('access_token', 'jwt')
    localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
    localStorage.setItem('device_context', JSON.stringify({ deviceId: 'd-1', name: 'Shared tablet' }))
    setActivePinia(createPinia())

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(useAuthStore().bindingStatus).toBe('unknown')
    expect(wrapper.findAll('[role="listitem"]')).toHaveLength(2)
  })
})
