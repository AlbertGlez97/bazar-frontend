const TEST_IDENTITY = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'
// ONE ACCOUNT PER PERSON: nobody picks a person. The account's person comes from
// GET /auth/me (set by the router guard), so this screen has no selector and never
// asks for the list of members. It only identifies the device, or explains why an
// account (inactive, unassigned, unconfirmed) cannot enter.
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
const networkError = () => Object.assign(new Error('Network Error'), { response: undefined })

type Account = Member | 'unassigned' | 'offline'

/** Inicia la pantalla como la dejaría el guard del router: sesión abierta y /auth/me ya consultado. */
async function signInAs(account: Account, opts: { deviceIdentified?: boolean } = {}) {
  localStorage.setItem('access_token', TEST_IDENTITY)
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
  localStorage.setItem('auth_username', 'x')
  localStorage.setItem('device_context_owner', JSON.stringify({ accountId: 'account-a', apiBase: '/api/v1' }))
  if (opts.deviceIdentified) {
    localStorage.setItem('device_context', JSON.stringify({ deviceId: 'd-1', name: 'Shared tablet' }))
  }
  setActivePinia(createPinia())
  if (account === 'offline') vi.mocked(AuthService.me).mockRejectedValue(networkError())
  else if (account === 'unassigned') vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: null, member: null })
  else vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: account.id, member: account })
  await useAuthStore().ensureBinding()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('SelectContextView with an account bound to a person', () => {
  it('device already identified: NO selector, no members request, straight into the app', async () => {
    await signInAs(colaborador, { deviceIdentified: true })

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('¿Quién atiende hoy?')
    expect(MembersService.list).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'AppHome' })
    expect(useSessionStore().member).toEqual(colaborador)
  })

  it('device not identified yet: asks only for the device, and after it goes into the app WITHOUT a selector', async () => {
    await signInAs(colaborador)
    vi.mocked(DevicesService.identify).mockResolvedValue({ deviceId: 'd-9', deviceToken: 'tok' })

    const wrapper = mount(SelectContextView)
    expect(wrapper.find('form').exists()).toBe(true)
    expect(push).not.toHaveBeenCalled()

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

  it('the section is labeled as the device identification (not as a person selector)', async () => {
    await signInAs(colaborador)
    const wrapper = mount(SelectContextView)
    expect(wrapper.get('section').attributes('aria-label')).toBe('Identificación del dispositivo')
  })
})

describe('SelectContextView with a deactivated person', () => {
  it('shows a clear message, no selector and no way into the app', async () => {
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

  it('offers to sign out, which clears the session and goes to login', async () => {
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

describe('SelectContextView with an account without a person (unassigned)', () => {
  it.each([false, true])('explains it, offers to sign out and never shows a selector (device identified: %s)', async (deviceIdentified) => {
    await signInAs('unassigned', { deviceIdentified })

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Tu cuenta no tiene una persona asignada')
    expect(wrapper.text()).toContain('Habla con un socio para que la revise. Mientras tanto no puedes entrar.')
    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(wrapper.find('[role="listitem"]').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.find('[data-test="retry"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="sign-out"]').text()).toBe('Cerrar sesión')
    expect(MembersService.list).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(useSessionStore().isContextReady).toBe(false)
  })

  it('"Cerrar sesión" clears the session and goes to login', async () => {
    await signInAs('unassigned', { deviceIdentified: true })
    const wrapper = mount(SelectContextView)
    await flushPromises()

    await wrapper.get('[data-test="sign-out"]').trigger('click')

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'Login' })
  })
})

describe('SelectContextView with an unconfirmed account (unknown)', () => {
  it('explains it, offers "Reintentar" and "Cerrar sesión", and shows no selector', async () => {
    await signInAs('offline', { deviceIdentified: true })

    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(useAuthStore().bindingStatus).toBe('unknown')
    expect(wrapper.get('h1').text()).toBe('No pudimos confirmar tu cuenta')
    expect(wrapper.text()).toContain('Revisa tu internet e intenta de nuevo.')
    expect(wrapper.get('[data-test="retry"]').text()).toBe('Reintentar')
    expect(wrapper.get('[data-test="sign-out"]').text()).toBe('Cerrar sesión')
    expect(wrapper.find('[role="list"]').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(MembersService.list).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('retry that succeeds binds the account and reaches the app', async () => {
    await signInAs('offline', { deviceIdentified: true })
    const wrapper = mount(SelectContextView)
    await flushPromises()
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: colaborador.id, member: colaborador })

    await wrapper.get('[data-test="retry"]').trigger('click')
    await flushPromises()

    expect(AuthService.me).toHaveBeenCalledTimes(2)
    expect(useAuthStore().bindingStatus).toBe('bound')
    expect(useSessionStore().member).toEqual(colaborador)
    expect(push).toHaveBeenCalledExactlyOnceWith({ name: 'AppHome' })
  })

  it('retry that fails stays on the same screen, without entering the app, and can be tried again', async () => {
    await signInAs('offline', { deviceIdentified: true })
    const wrapper = mount(SelectContextView)
    await flushPromises()

    await wrapper.get('[data-test="retry"]').trigger('click')
    await flushPromises()

    expect(AuthService.me).toHaveBeenCalledTimes(2)
    expect(useAuthStore().bindingStatus).toBe('unknown')
    expect(wrapper.get('h1').text()).toBe('No pudimos confirmar tu cuenta')
    expect(wrapper.find('[data-test="retry"]').attributes('disabled')).toBeUndefined()
    expect(push).not.toHaveBeenCalled()
  })

  it('retry that succeeds on an account that still lacks the device keeps asking only for the device', async () => {
    await signInAs('offline')
    const wrapper = mount(SelectContextView)
    await flushPromises()
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: socio.id, member: socio })

    await wrapper.get('[data-test="retry"]').trigger('click')
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
    expect(wrapper.get('h1').text()).toBe('Falta registrar este dispositivo')
    expect(wrapper.find('form').exists()).toBe(true)
  })

  it('retry that turns out to be an unassigned account shows that explanation', async () => {
    await signInAs('offline', { deviceIdentified: true })
    const wrapper = mount(SelectContextView)
    await flushPromises()
    vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: null, member: null })

    await wrapper.get('[data-test="retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Tu cuenta no tiene una persona asignada')
    expect(push).not.toHaveBeenCalled()
  })

  it('"Cerrar sesión" clears the session and goes to login', async () => {
    await signInAs('offline')
    const wrapper = mount(SelectContextView)
    await flushPromises()

    await wrapper.get('[data-test="sign-out"]').trigger('click')

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'Login' })
  })
})

describe('cuenta atada que llega sin dispositivo (aceptó en otra computadora y ahora usa otro teléfono)', () => {
  it('dice "Falta registrar este dispositivo" y explica cómo conseguir el código, en frases cortas', async () => {
    await signInAs(socio)
    const wrapper = mount(SelectContextView)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Falta registrar este dispositivo')
    const text = wrapper.text()
    expect(text).toContain('Un socio te puede dar un código. Pídele que entre a Ajustes y luego a Dispositivos, y toque Registrar dispositivo. Escribe aquí el código y el nombre que te dé.')
    expect(text).toContain('El código sirve una sola vez.')
    expect(text).not.toContain('Solo lo haces una vez por dispositivo')
    for (const sentence of text.split(/(?<=[.!?])\s+/))
      expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(20)
    expect(MembersService.list).not.toHaveBeenCalled()
  })

  it('el campo se llama "Código del dispositivo" y sigue pidiendo el nombre exacto', async () => {
    await signInAs(socio)
    const wrapper = mount(SelectContextView)
    await flushPromises()
    const labels = wrapper.findAll('label').map((l) => l.text())
    expect(labels).toEqual(['Código del dispositivo', 'Nombre del dispositivo'])
  })

  it('un código ya usado (409) dice "Este código ya se usó…", aunque el servidor hable de "identificador"', async () => {
    vi.mocked(DevicesService.identify).mockRejectedValue({ response: { status: 409, data: { message: 'Este identificador ya fue usado. Pide a un socio que te genere uno nuevo.' } } })
    await signInAs(socio)
    const wrapper = mount(SelectContextView)
    await flushPromises()
    await wrapper.findAll('input')[0]!.setValue('abc')
    await wrapper.findAll('input')[1]!.setValue('Tablet')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Este código ya se usó. Pide a un socio que te registre un dispositivo nuevo.')
    expect(wrapper.text()).not.toContain('identificador')
  })

  it('al registrarlo con un código válido entra directo a la app, sin selector de persona', async () => {
    vi.mocked(DevicesService.identify).mockResolvedValue({ deviceId: 'd-new', deviceToken: 'tok' })
    await signInAs(socio)
    const wrapper = mount(SelectContextView)
    await flushPromises()
    await wrapper.findAll('input')[0]!.setValue('abc')
    await wrapper.findAll('input')[1]!.setValue('Tablet')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'AppHome' })
    expect(MembersService.list).not.toHaveBeenCalled()
  })
})
