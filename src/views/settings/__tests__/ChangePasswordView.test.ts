// Cambiar mi contraseña (contenedor): componentes y stores REALES; solo se
// simula la red (AuthService). El 403 de "contraseña actual incorrecta" nunca
// cierra la sesión: eso se prueba con el interceptor real en
// auth.service.change-password.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import ChangePasswordView from '../ChangePasswordView.vue'
import AuthService from '@/services/auth.service'
import { useSessionStore } from '@/stores/session.store'
import { VOICE } from '@/config/voice'

vi.mock('@/services/auth.service', () => ({ default: { changePassword: vi.fn(), login: vi.fn() } }))
const changePassword = vi.mocked(AuthService.changePassword)

const CURRENT = 'la-de-hoy-123'
const NEW = 'la-de-manana-456'

async function mountView() {
  const session = useSessionStore()
  session.setMember({ id: 'm-1', name: 'Ana', role: 'colaborador', active: true })
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/ajustes', name: 'Settings', component: stub },
      { path: '/app/ajustes/contrasena', name: 'ChangePassword', component: ChangePasswordView },
      { path: '/login', name: 'Login', component: stub },
    ],
  })
  router.push('/app/ajustes/contrasena')
  await router.isReady()
  const wrapper = mount(ChangePasswordView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}
type Wrapper = Awaited<ReturnType<typeof mountView>>['wrapper']

const fields = (w: Wrapper) => w.findAll('input')
async function fillAndSubmit(w: Wrapper, current = CURRENT, next = NEW, confirm = NEW) {
  const [c, n, r] = fields(w)
  await c.setValue(current)
  await n.setValue(next)
  await r.setValue(confirm)
  await w.find('form').trigger('submit')
  await flushPromises()
}
const fieldErrors = (w: Wrapper) => w.findAll('.app-input__error').map((e) => e.text())
const alerts = (w: Wrapper) => w.findAll('[role="alert"]').map((a) => a.text())
const failure = (status: number, message?: unknown) => ({ response: { status, data: { message } } })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  changePassword.mockReset().mockResolvedValue(undefined)
})

describe('ChangePasswordView — estructura', () => {
  it('tiene el título, una explicación y un enlace para volver a ajustes', async () => {
    const { wrapper } = await mountView()
    expect(wrapper.get('h1').text()).toBe('Cambiar mi contraseña')
    expect(wrapper.get('a[href="/app/ajustes"]').text()).toContain('Volver a ajustes')
    expect(wrapper.findAll('input')).toHaveLength(3)
  })
})

describe('ChangePasswordView — éxito', () => {
  it('envía { currentPassword, newPassword } y confirma con un hecho concreto', async () => {
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(changePassword).toHaveBeenCalledExactlyOnceWith({ currentPassword: CURRENT, newPassword: NEW })
    expect(alerts(wrapper)).toEqual([VOICE.changePassword.success])
  })

  it('limpia los tres campos tras el éxito (no deja contraseñas a la vista)', async () => {
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(fields(wrapper).map((f) => (f.element as HTMLInputElement).value)).toEqual(['', '', ''])
  })

  it('tras el éxito se puede cambiar otra vez, y la confirmación anterior se retira al enviar', async () => {
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    changePassword.mockRejectedValueOnce(failure(403, 'Current password is incorrect'))
    await fillAndSubmit(wrapper, 'otra-mala-999', NEW, NEW)
    expect(alerts(wrapper)).toEqual([])
    expect(fieldErrors(wrapper)).toEqual([VOICE.changePassword.wrongCurrent])
  })

  it('no navega ni cierra la sesión', async () => {
    const { wrapper, router } = await mountView()
    await fillAndSubmit(wrapper)
    expect(router.currentRoute.value.name).toBe('ChangePassword')
    expect(useSessionStore().member?.id).toBe('m-1')
  })
})

describe('ChangePasswordView — errores', () => {
  it('403: "La contraseña actual no es correcta." en el campo de la contraseña actual, sin alerta', async () => {
    changePassword.mockRejectedValue(failure(403, 'Current password is incorrect'))
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(fieldErrors(wrapper)).toEqual(['La contraseña actual no es correcta.'])
    expect(alerts(wrapper)).toEqual([])
    expect(fields(wrapper)[0].attributes('aria-invalid')).toBe('true')
  })

  it('403: lo escrito se conserva para corregir solo la contraseña actual', async () => {
    changePassword.mockRejectedValue(failure(403, 'Current password is incorrect'))
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(fields(wrapper).map((f) => (f.element as HTMLInputElement).value)).toEqual([CURRENT, NEW, NEW])
  })

  it('403: no cierra la sesión ni manda al login', async () => {
    changePassword.mockRejectedValue(failure(403))
    const { wrapper, router } = await mountView()
    await fillAndSubmit(wrapper)
    expect(router.currentRoute.value.name).toBe('ChangePassword')
    expect(useSessionStore().member?.id).toBe('m-1')
  })

  it('400 "igual a la actual": el motivo va bajo la contraseña nueva', async () => {
    changePassword.mockRejectedValue(failure(400, 'newPassword must be different from the current password'))
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(fieldErrors(wrapper)).toEqual([VOICE.changePassword.sameAsCurrent])
  })

  it('400 de largo: explica el largo permitido bajo la contraseña nueva', async () => {
    changePassword.mockRejectedValue(failure(400, ['newPassword must be longer than or equal to 10 characters']))
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(fieldErrors(wrapper)).toEqual([VOICE.changePassword.badLength])
  })

  it('400 desconocido: mensaje amable, nunca el texto crudo', async () => {
    changePassword.mockRejectedValue(failure(400, 'quién sabe'))
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(fieldErrors(wrapper)).toEqual([VOICE.changePassword.invalidNew])
    expect(wrapper.text()).not.toContain('quién sabe')
  })

  it('sin red: alerta con el mensaje de red y el formulario sigue editable', async () => {
    changePassword.mockRejectedValue(new Error('Network Error'))
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(alerts(wrapper)).toEqual([VOICE.networkError])
    expect(fields(wrapper).every((f) => f.attributes('disabled') === undefined)).toBe(true)
  })

  it.each([500, 502])('%i: alerta genérica', async (status) => {
    changePassword.mockRejectedValue(failure(status))
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(alerts(wrapper)).toEqual([VOICE.genericError])
  })

  it('un error viejo se retira al reenviar', async () => {
    changePassword.mockRejectedValueOnce(failure(403)).mockResolvedValueOnce(undefined)
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)
    expect(fieldErrors(wrapper)).toHaveLength(1)
    await fillAndSubmit(wrapper)
    expect(fieldErrors(wrapper)).toEqual([])
    expect(alerts(wrapper)).toEqual([VOICE.changePassword.success])
  })
})

describe('ChangePasswordView — envío en curso', () => {
  it('mientras espera: botón en carga, campos deshabilitados y un segundo envío no repite la llamada', async () => {
    let resolve!: () => void
    changePassword.mockReturnValue(new Promise<void>((r) => { resolve = r }))
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper)

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(fields(wrapper).every((f) => f.attributes('disabled') !== undefined)).toBe(true)

    await wrapper.find('form').trigger('submit')
    expect(changePassword).toHaveBeenCalledTimes(1)

    resolve()
    await flushPromises()
    expect(alerts(wrapper)).toEqual([VOICE.changePassword.success])
  })

  it('con una validación de cliente fallida no se llama al servidor', async () => {
    const { wrapper } = await mountView()
    await fillAndSubmit(wrapper, CURRENT, 'corta', 'corta')
    expect(changePassword).not.toHaveBeenCalled()
  })
})
