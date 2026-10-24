// Ninguna pantalla de /seleccionar-contexto puede dejar a la persona sin salida.
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SelectContextView from '../SelectContextView.vue'
import DevicesService from '@/services/devices.service'
import AuthService from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import type { Member } from '@/types/member.types'

vi.mock('@/services/devices.service', () => ({ default: { identify: vi.fn() } }))
vi.mock('@/services/auth.service', () => ({ default: { login: vi.fn(), me: vi.fn() } }))

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const TOKEN = 'a.' + btoa(JSON.stringify({ sub: 'account-a' })) + '.z'
const socio: Member = { id: 'm-soc', name: 'Alberto', role: 'socio', active: true }

type Kind = 'bound' | 'inactive' | 'unassigned' | 'unknown'

/** Abre la pantalla como la dejaría el guard del router, según lo que diga /auth/me. */
async function openAs(kind: Kind, opts: { device?: boolean } = {}) {
  localStorage.setItem('access_token', TOKEN)
  localStorage.setItem('token_expires_at', String(Date.now() + 60_000))
  if (opts.device) localStorage.setItem('device_contexts', JSON.stringify({ version: 1, devices: { 'account-a|/api/v1': { deviceId: 'd-1', name: 'Tablet' } } }))
  setActivePinia(createPinia())
  if (kind === 'unknown') vi.mocked(AuthService.me).mockRejectedValue(Object.assign(new Error('Network Error'), { response: undefined }))
  else if (kind === 'unassigned') vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: null, member: null })
  else vi.mocked(AuthService.me).mockResolvedValue({ username: 'x', memberId: socio.id, member: { ...socio, active: kind === 'bound' } })
  await useAuthStore().ensureBinding()
  const wrapper = mount(SelectContextView, { attachTo: document.body })
  await flushPromises()
  return wrapper
}
const exitButton = (w: ReturnType<typeof mount>) => w.find('[data-test="exit"]')

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('pantalla "Falta registrar este dispositivo"', () => {
  it('trae el botón "No lo tengo, salir" con su texto de apoyo, visible y secundario', async () => {
    const w = await openAs('bound')
    expect(w.get('h1').text()).toBe('Falta registrar este dispositivo')
    const button = exitButton(w)
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('No lo tengo, salir')
    expect(button.attributes('type')).toBe('button')
    expect(w.text()).toContain('Puedes volver cuando un socio te dé el código.')
    // Es secundario: el botón principal sigue siendo "Identificar dispositivo".
    expect(w.get('form button[type="submit"]').text()).toBe('Identificar dispositivo')
    expect(button.classes().join(' ')).not.toContain('primary')
  })

  it('al tocarlo cierra la sesión, lleva al login y no envía el formulario', async () => {
    const w = await openAs('bound')
    await exitButton(w).trigger('click')

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(push).toHaveBeenCalledWith({ name: 'Login' })
    expect(DevicesService.identify).not.toHaveBeenCalled()
  })

  it('salir no borra el dispositivo ya guardado de esa cuenta', async () => {
    const w = await openAs('bound')
    useSessionStore().saveDeviceForAccount('account-a', { deviceId: 'd-keep', name: 'Tablet' })
    await exitButton(w).trigger('click')
    expect(localStorage.getItem('device_contexts')).toContain('d-keep')
  })

  it('sigue habiendo salida después de un error al identificar (403 y 409)', async () => {
    for (const status of [403, 409]) {
      vi.mocked(DevicesService.identify).mockRejectedValue({ response: { status } })
      const w = await openAs('bound')
      await w.findAll('input')[0]!.setValue('abc')
      await w.findAll('input')[1]!.setValue('Tablet')
      await w.get('form').trigger('submit')
      await flushPromises()
      expect(w.find('[role="alert"]').exists()).toBe(true)
      expect(exitButton(w).exists()).toBe(true)
      w.unmount()
      localStorage.clear(); sessionStorage.clear()
    }
  })
})

describe('pantalla "Entrando…", cuentas bloqueadas y sin selector de persona', () => {
  it('"Entrando…" (cuenta con persona y dispositivo) también tiene "Cerrar sesión", por si no avanza', async () => {
    const w = await openAs('bound', { device: true })
    expect(w.get('h1').text()).toBe('Entrando…')
    expect(exitButton(w).text()).toBe('Cerrar sesión')
    expect(w.text()).not.toContain('Puedes volver cuando un socio te dé el código.')
    await exitButton(w).trigger('click')
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'Login' })
  })

  it('"Tu acceso está desactivado" tiene su salida y no repite el botón "exit"', async () => {
    const w = await openAs('inactive')
    expect(w.get('h1').text()).toBe('Tu acceso está desactivado')
    expect(w.findAll('[data-test="exit"]')).toHaveLength(0)
    const button = w.get('[data-test="sign-out"]')
    expect(button.text()).toBe('Cerrar sesión')
    await button.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'Login' })
  })

  it('"Tu cuenta no tiene una persona asignada" tiene su salida y no repite el botón "exit"', async () => {
    const w = await openAs('unassigned', { device: true })
    expect(w.get('h1').text()).toBe('Tu cuenta no tiene una persona asignada')
    expect(w.findAll('[data-test="exit"]')).toHaveLength(0)
    await w.get('[data-test="sign-out"]').trigger('click')
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'Login' })
  })

  it('"No pudimos confirmar tu cuenta" tiene su salida (además de "Reintentar") y no repite el botón "exit"', async () => {
    const w = await openAs('unknown')
    expect(w.get('h1').text()).toBe('No pudimos confirmar tu cuenta')
    expect(w.findAll('[data-test="exit"]')).toHaveLength(0)
    expect(w.find('[data-test="retry"]').exists()).toBe(true)
    await w.get('[data-test="sign-out"]').trigger('click')
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(push).toHaveBeenCalledWith({ name: 'Login' })
  })

  it('ninguna pantalla muestra la pregunta "¿Quién atiende hoy?"', async () => {
    for (const kind of ['bound', 'inactive', 'unassigned', 'unknown'] as const) {
      const w = await openAs(kind, { device: true })
      expect(w.text()).not.toContain('¿Quién atiende hoy?')
      expect(w.find('[role="list"]').exists()).toBe(false)
      w.unmount()
      localStorage.clear(); sessionStorage.clear()
    }
  })
})

describe('accesibilidad', () => {
  it('el botón de salida tiene nombre accesible, se alcanza con Tab después del formulario y no se activa solo', async () => {
    const w = await openAs('bound')
    const names = w.findAll('button, input, a').map((e) => e.text() || e.attributes('aria-label') || e.attributes('name'))
    expect(w.get('[data-test="exit"]').element.textContent?.trim()).toBe('No lo tengo, salir')
    // Orden del documento: campos → "Identificar dispositivo" → "No lo tengo, salir".
    const buttons = w.findAll('button').map((b) => b.text())
    expect(buttons.indexOf('Identificar dispositivo')).toBeLessThan(buttons.indexOf('No lo tengo, salir'))
    expect(names.length).toBeGreaterThan(2)
    expect(push).not.toHaveBeenCalled()
  })
})
