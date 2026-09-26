// Dispositivos (contenedor): componentes y stores REALES; solo se simula la red
// (DevicesAdminService) y el portapapeles. Los cuadros usan el Teleport REAL, así
// que se consulta el DOM completo en `document.body`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import DevicesView from '../DevicesView.vue'
import DevicesAdminService from '@/services/devices-admin.service'
import { useSessionStore } from '@/stores/session.store'
import { VOICE } from '@/config/voice'
import type { DeviceWithCode, ManagedDevice } from '@/types/device.types'

vi.mock('@/services/devices-admin.service', () => ({
  default: { list: vi.fn(), create: vi.fn(), revoke: vi.fn(), reissue: vi.fn() },
}))
const copy = vi.hoisted(() => vi.fn())
vi.mock('@/composables/useClipboard', () => ({ useClipboard: () => ({ copy }) }))

const list = vi.mocked(DevicesAdminService.list)
const create = vi.mocked(DevicesAdminService.create)
const revoke = vi.mocked(DevicesAdminService.revoke)
const reissue = vi.mocked(DevicesAdminService.reissue)

const base = { createdAt: '2026-09-25T18:00:00.000Z', activatedAt: null, revokedAt: null }
const DEVICES: ManagedDevice[] = [
  { ...base, id: 'd-1', name: 'Mostrador', status: 'activo', legacy: false },
  { ...base, id: 'd-2', name: 'Tablet vieja', status: 'activo', legacy: true },
  { ...base, id: 'd-3', name: 'Teléfono de Ana', status: 'pendiente_activacion', legacy: false, identifier: '0190-codigo-3' },
  { ...base, id: 'd-4', name: 'Perdido', status: 'revocado', legacy: false },
]
const NEW_CODE = '0190a5f0-7c3e-7000-8000-00000000c0de'
const CREATED: DeviceWithCode = { ...base, id: 'd-9', name: 'Tablet nueva', status: 'pendiente_activacion', legacy: false, identifier: NEW_CODE }
const EMAILED: DeviceWithCode = { ...base, id: 'd-9', name: 'Tablet nueva', status: 'pendiente_activacion', legacy: false, deliveredTo: 'recipient' }

const mounted: Array<{ unmount: () => void }> = []

async function mountView(role: 'socio' | 'colaborador' = 'socio', currentDeviceId = 'd-1') {
  const session = useSessionStore()
  session.setDevice({ deviceId: currentDeviceId, name: 'Mostrador' })
  session.setMember({ id: 'm-1', name: 'Ana Ruiz', role, active: true })
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app', name: 'AppHome', component: stub },
      { path: '/app/ajustes', name: 'Settings', component: stub },
      { path: '/app/ajustes/dispositivos', name: 'DevicesAdmin', component: DevicesView },
    ],
  })
  router.push('/app/ajustes/dispositivos')
  await router.isReady()
  const wrapper = mount(DevicesView, { attachTo: document.body, global: { plugins: [router] } })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router, session }
}

const dom = (selector: string) => {
  const el = document.body.querySelector(selector)
  return el ? new DOMWrapper(el) : null
}
const domAll = (selector: string) => Array.from(document.body.querySelectorAll(selector)).map((el) => new DOMWrapper(el))
const button = (text: string) => domAll('button').find((b) => b.text() === text)
const byLabel = (label: string) => dom(`button[aria-label="${label}"]`)!
const rows = () => domAll('li.device-list__item')
const alerts = () => domAll('[role="alert"]').map((a) => a.text())
const fieldErrors = () => domAll('.app-input__error').map((e) => e.text())
const inputByLabel = (label: string) => {
  const l = domAll('label').find((x) => x.text() === label)!
  return dom(`#${l.attributes('for')}`)!
}
const failure = (status: number, message?: unknown) => ({ response: { status, data: { message } } })

async function registerDevice(name = 'Tablet nueva', correo?: string) {
  await button('Registrar dispositivo')!.trigger('click')
  await inputByLabel('Nombre del dispositivo').setValue(name)
  if (correo) await inputByLabel('Correo para enviarle el código (opcional)').setValue(correo)
  await dom('.device-create-form')!.trigger('submit')
  await flushPromises()
}
async function confirmAction(correo?: string) {
  if (correo) await inputByLabel('Enviar el código por correo (opcional)').setValue(correo)
  await dom('.device-action-confirm')!.trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  list.mockReset().mockResolvedValue(DEVICES)
  create.mockReset().mockResolvedValue(CREATED)
  revoke.mockReset().mockResolvedValue({ ...DEVICES[0], status: 'revocado' })
  reissue.mockReset().mockResolvedValue({ ...DEVICES[0], status: 'pendiente_activacion', identifier: NEW_CODE })
  copy.mockReset().mockResolvedValue(true)
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

describe('DevicesView — lista', () => {
  it('al abrir pide la lista', async () => {
    await mountView()
    expect(list).toHaveBeenCalledExactlyOnceWith()
  })

  it('muestra el título, los estados en texto y marca el dispositivo que se está usando', async () => {
    await mountView()
    expect(dom('h1')!.text()).toBe('Dispositivos')
    expect(rows().map((r) => r.find('.device-list__name').text())).toEqual(['Mostrador', 'Tablet vieja', 'Teléfono de Ana', 'Perdido'])
    expect(rows().map((r) => r.find('.device-list__status').text())).toEqual(['Activo', 'Activo', 'Pendiente de activar', 'Revocado'])
    expect(rows()[0].find('.device-list__current').exists()).toBe(true)
    expect(rows()[1].find('.device-list__legacy').exists()).toBe(true)
  })

  it('mientras carga muestra un estado de carga (y no la lista)', async () => {
    let resolve!: (v: ManagedDevice[]) => void
    list.mockReturnValue(new Promise<ManagedDevice[]>((r) => { resolve = r }))
    await mountView()
    expect(dom('.devices-view__loading')!.text()).toContain(VOICE.devices.loading)
    expect(dom('.devices-view__loading')!.attributes('role')).toBe('status')
    expect(rows()).toHaveLength(0)
    resolve(DEVICES)
    await flushPromises()
    expect(rows()).toHaveLength(4)
  })

  it('si falla la carga: mensaje claro y "Intentar de nuevo", que vuelve a pedir', async () => {
    list.mockRejectedValueOnce(failure(500))
    await mountView()
    expect(alerts()).toEqual([VOICE.devices.loadError])
    await button('Intentar de nuevo')!.trigger('click')
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(2)
    expect(rows()).toHaveLength(4)
  })

  it('403 al cargar: dice que es solo para socios', async () => {
    list.mockRejectedValueOnce(failure(403))
    await mountView()
    expect(alerts()).toEqual([VOICE.devices.forbidden])
  })

  it('sin red al cargar: mensaje de red', async () => {
    list.mockRejectedValueOnce(new Error('Network Error'))
    await mountView()
    expect(alerts()).toEqual([VOICE.networkError])
  })

  it('tiene un enlace para volver a ajustes', async () => {
    await mountView()
    expect(dom('a[href="/app/ajustes"]')!.text()).toContain('Volver a ajustes')
  })

  it('si la persona deja de ser socio con la vista abierta, sale a Inicio', async () => {
    const { router, session } = await mountView()
    session.setMember({ id: 'm-2', name: 'Carlos', role: 'colaborador', active: true })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('AppHome')
  })

  it('una respuesta vieja nunca pisa a la nueva (registro mientras la primera carga sigue en camino)', async () => {
    let resolveFirst!: (v: ManagedDevice[]) => void
    list.mockReset()
      .mockReturnValueOnce(new Promise<ManagedDevice[]>((r) => { resolveFirst = r }))
      .mockResolvedValueOnce([...DEVICES, CREATED])
    await mountView()
    await registerDevice()
    expect(rows()).toHaveLength(5)
    resolveFirst(DEVICES)
    await flushPromises()
    expect(rows()).toHaveLength(5)
  })
})

describe('DevicesView — registrar un dispositivo', () => {
  it('"Registrar dispositivo" abre el formulario en un cuadro con título y se puede cancelar', async () => {
    await mountView()
    expect(dom('.device-create-form')).toBeNull()
    await button('Registrar dispositivo')!.trigger('click')
    expect(dom('[role="dialog"]')).not.toBeNull()
    expect(dom('.app-modal__title')!.text()).toBe('Registrar dispositivo')
    await button('Cancelar')!.trigger('click')
    expect(dom('.device-create-form')).toBeNull()
  })

  it('sin correo: envía solo el nombre, cierra el cuadro, MUESTRA el código una vez y recarga la lista', async () => {
    await mountView()
    await registerDevice('Tablet nueva')
    expect(create).toHaveBeenCalledExactlyOnceWith({ name: 'Tablet nueva' })
    expect(dom('.device-create-form')).toBeNull()
    const notice = dom('.device-code-notice')!
    expect(notice.find('.device-code-notice__code').text()).toBe(NEW_CODE)
    expect(notice.text()).toContain('Tablet nueva')
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('el código no se guarda en el almacenamiento del navegador', async () => {
    await mountView()
    await registerDevice()
    expect(JSON.stringify({ ...localStorage })).not.toContain(NEW_CODE)
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(NEW_CODE)
  })

  it('con correo: lo envía, y el aviso dice adónde fue SIN mostrar ningún código', async () => {
    create.mockResolvedValue(EMAILED)
    await mountView()
    await registerDevice('Tablet nueva', 'ana@example.com')
    expect(create).toHaveBeenCalledExactlyOnceWith({ name: 'Tablet nueva', correoEnvio: 'ana@example.com' })
    const notice = dom('.device-code-notice')!
    expect(notice.text()).toContain('ana@example.com')
    expect(notice.find('.device-code-notice__code').exists()).toBe(false)
  })

  it('correo en modo de prueba (approver-fallback): aviso honesto, no de éxito', async () => {
    create.mockResolvedValue({ ...EMAILED, deliveredTo: 'approver-fallback' })
    await mountView()
    await registerDevice('Tablet nueva', 'ana@example.com')
    const notice = dom('.device-code-notice')!
    expect(notice.find('.app-alert--warning').exists()).toBe(true)
    expect(notice.text()).toContain('modo de prueba')
  })

  it('"Copiar código" del aviso copia el código y lo anuncia', async () => {
    await mountView()
    await registerDevice()
    await button('Copiar código')!.trigger('click')
    await flushPromises()
    expect(copy).toHaveBeenCalledExactlyOnceWith(NEW_CODE)
    expect(dom('.device-code-notice [role="status"]')!.text()).toBe('Código copiado.')
  })

  it('si no se pudo copiar, lo dice y deja el código a la vista para copiarlo a mano', async () => {
    copy.mockResolvedValue(false)
    await mountView()
    await registerDevice()
    await button('Copiar código')!.trigger('click')
    await flushPromises()
    expect(dom('.device-code-notice [role="status"]')!.text()).toContain('No pudimos copiarlo')
    expect(dom('.device-code-notice__code')!.text()).toBe(NEW_CODE)
  })

  it('"Entendido" retira el aviso (el código ya no se ve)', async () => {
    await mountView()
    await registerDevice()
    await button('Entendido')!.trigger('click')
    expect(dom('.device-code-notice')).toBeNull()
    expect(document.body.textContent).not.toContain(NEW_CODE)
  })

  it('un aviso anterior se retira al iniciar otro registro', async () => {
    await mountView()
    await registerDevice()
    await button('Registrar dispositivo')!.trigger('click')
    expect(dom('.device-code-notice')).toBeNull()
  })

  it('al volver a abrir el cuadro el formulario está vacío', async () => {
    await mountView()
    await registerDevice()
    await button('Registrar dispositivo')!.trigger('click')
    expect((inputByLabel('Nombre del dispositivo').element as HTMLInputElement).value).toBe('')
  })

  it('400 con el correo mal: se marca en el campo y lo escrito se conserva', async () => {
    create.mockRejectedValue(failure(400, 'Escribe un correo válido, por ejemplo nombre@dominio.com'))
    await mountView()
    await registerDevice('Tablet nueva', 'ana@example.com')
    expect(fieldErrors()).toEqual([VOICE.devices.badEmail])
    expect((inputByLabel('Nombre del dispositivo').element as HTMLInputElement).value).toBe('Tablet nueva')
    expect(dom('.device-code-notice')).toBeNull()
  })

  it('403: solo un socio puede administrar dispositivos', async () => {
    create.mockRejectedValue(failure(403))
    await mountView()
    await registerDevice()
    expect(alerts()).toEqual([VOICE.devices.forbidden])
  })

  it('502: no se hizo ningún cambio, la lista NO se recarga y se puede reintentar sin volver a escribir', async () => {
    create.mockRejectedValueOnce(failure(502)).mockResolvedValueOnce(CREATED)
    await mountView()
    await registerDevice('Tablet nueva', 'ana@example.com')
    expect(alerts()).toEqual([VOICE.devices.emailFailed])
    expect(list).toHaveBeenCalledTimes(1)
    await dom('.device-create-form')!.trigger('submit')
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(2)
    expect(dom('.device-code-notice')).not.toBeNull()
  })

  it('sin red: mensaje de red', async () => {
    create.mockRejectedValue(new Error('Network Error'))
    await mountView()
    await registerDevice()
    expect(alerts()).toEqual([VOICE.networkError])
  })

  it('mientras espera: el formulario queda deshabilitado, un segundo envío no repite y no se puede cerrar', async () => {
    let resolve!: (v: DeviceWithCode) => void
    create.mockReturnValue(new Promise<DeviceWithCode>((r) => { resolve = r }))
    await mountView()
    await registerDevice()
    expect(dom('.device-create-form button[type="submit"]')!.attributes('disabled')).toBeDefined()
    await dom('.device-create-form')!.trigger('submit')
    expect(create).toHaveBeenCalledTimes(1)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(dom('.device-create-form')).not.toBeNull()

    resolve(CREATED)
    await flushPromises()
    expect(dom('.device-code-notice')).not.toBeNull()
  })

  it('con una validación de cliente fallida no se llama al servidor', async () => {
    await mountView()
    await button('Registrar dispositivo')!.trigger('click')
    await dom('.device-create-form')!.trigger('submit')
    expect(create).not.toHaveBeenCalled()
  })
})

describe('DevicesView — copiar el código de un dispositivo pendiente', () => {
  it('copia el código de esa fila y lo anuncia', async () => {
    await mountView()
    await byLabel('Copiar código de Teléfono de Ana').trigger('click')
    await flushPromises()
    expect(copy).toHaveBeenCalledExactlyOnceWith('0190-codigo-3')
    expect(dom('.devices-view__copy')!.text()).toContain('Código copiado')
    expect(dom('.devices-view__copy')!.text()).toContain('Teléfono de Ana')
  })

  it('si falla, lo dice', async () => {
    copy.mockResolvedValue(false)
    await mountView()
    await byLabel('Copiar código de Teléfono de Ana').trigger('click')
    await flushPromises()
    expect(dom('.devices-view__copy')!.text()).toContain('No pudimos copiarlo')
  })

  it('el código nunca aparece en pantalla en la lista', async () => {
    await mountView()
    expect(document.body.textContent).not.toContain('0190-codigo-3')
  })
})

describe('DevicesView — revocar', () => {
  it('pide confirmación con el nombre; "Mejor no" cierra sin llamar al servidor', async () => {
    await mountView()
    await byLabel('Revocar Tablet vieja').trigger('click')
    expect(dom('.app-modal__title')!.text()).toBe('Revocar dispositivo')
    expect(dom('.device-action-confirm')!.text()).toContain('Tablet vieja')
    await button('Mejor no')!.trigger('click')
    expect(dom('.device-action-confirm')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
  })

  it('confirmar revoca ESE dispositivo, cierra, avisa con un hecho concreto y recarga la lista', async () => {
    await mountView()
    await byLabel('Revocar Tablet vieja').trigger('click')
    await confirmAction()
    expect(revoke).toHaveBeenCalledExactlyOnceWith('d-2')
    expect(dom('.device-action-confirm')).toBeNull()
    expect(dom('.devices-view__flash')!.text()).toContain('Revocamos «Tablet vieja»')
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('si es el dispositivo que se está usando, la confirmación avisa que se desconectará', async () => {
    await mountView('socio', 'd-1')
    await byLabel('Revocar Mostrador').trigger('click')
    expect(dom('.device-action-confirm')!.text()).toContain('el dispositivo que estás usando')
  })

  it('y tras revocarlo lo confirma con la misma claridad', async () => {
    await mountView('socio', 'd-1')
    await byLabel('Revocar Mostrador').trigger('click')
    await confirmAction()
    expect(dom('.devices-view__flash')!.text()).toContain('estás usando')
  })

  it('si NO es el que se usa, no hay ese aviso', async () => {
    await mountView('socio', 'd-1')
    await byLabel('Revocar Tablet vieja').trigger('click')
    expect(dom('.device-action-confirm')!.text()).not.toContain('el dispositivo que estás usando')
  })

  it('404 (ya no existe): cierra, lo dice y recarga la lista', async () => {
    revoke.mockRejectedValue(failure(404))
    await mountView()
    await byLabel('Revocar Tablet vieja').trigger('click')
    await confirmAction()
    expect(dom('.device-action-confirm')).toBeNull()
    expect(alerts()).toContain(VOICE.devices.notFound)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('403: el error queda en el cuadro, que sigue abierto', async () => {
    revoke.mockRejectedValue(failure(403))
    await mountView()
    await byLabel('Revocar Tablet vieja').trigger('click')
    await confirmAction()
    expect(dom('.device-action-confirm')).not.toBeNull()
    expect(alerts()).toEqual([VOICE.devices.forbidden])
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('sin red: mensaje de red en el cuadro, y se puede reintentar', async () => {
    revoke.mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(DEVICES[1])
    await mountView()
    await byLabel('Revocar Tablet vieja').trigger('click')
    await confirmAction()
    expect(alerts()).toEqual([VOICE.networkError])
    await confirmAction()
    expect(revoke).toHaveBeenCalledTimes(2)
    expect(dom('.device-action-confirm')).toBeNull()
  })

  it('error genérico (500)', async () => {
    revoke.mockRejectedValue(failure(500))
    await mountView()
    await byLabel('Revocar Tablet vieja').trigger('click')
    await confirmAction()
    expect(alerts()).toEqual([VOICE.genericError])
  })

  it('mientras espera: no repite la llamada y no se puede cerrar el cuadro', async () => {
    let resolve!: (v: ManagedDevice) => void
    revoke.mockReturnValue(new Promise<ManagedDevice>((r) => { resolve = r }))
    await mountView()
    await byLabel('Revocar Tablet vieja').trigger('click')
    await confirmAction()
    await dom('.device-action-confirm')!.trigger('submit')
    expect(revoke).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(dom('.device-action-confirm')).not.toBeNull()
    resolve(DEVICES[1])
    await flushPromises()
    expect(dom('.device-action-confirm')).toBeNull()
  })
})

describe('DevicesView — reemitir', () => {
  it('pide confirmación con el nombre y ofrece un correo opcional', async () => {
    await mountView()
    await byLabel('Reemitir Tablet vieja').trigger('click')
    expect(dom('.app-modal__title')!.text()).toBe('Reemitir código')
    expect(dom('.device-action-confirm')!.text()).toContain('Tablet vieja')
    expect(inputByLabel('Enviar el código por correo (opcional)')).not.toBeNull()
  })

  it('sin correo: reemite ESE dispositivo y MUESTRA el código nuevo una vez', async () => {
    await mountView()
    await byLabel('Reemitir Tablet vieja').trigger('click')
    await confirmAction()
    expect(reissue).toHaveBeenCalledExactlyOnceWith('d-2', {})
    expect(dom('.device-action-confirm')).toBeNull()
    const notice = dom('.device-code-notice')!
    expect(notice.find('.device-code-notice__code').text()).toBe(NEW_CODE)
    expect(notice.text()).toContain('dejó de funcionar')
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('con correo: lo envía y el aviso dice adónde fue, sin mostrar código', async () => {
    reissue.mockResolvedValue({ ...DEVICES[1], status: 'pendiente_activacion', deliveredTo: 'recipient' })
    await mountView()
    await byLabel('Reemitir Tablet vieja').trigger('click')
    await confirmAction('ana@example.com')
    expect(reissue).toHaveBeenCalledExactlyOnceWith('d-2', { correoEnvio: 'ana@example.com' })
    const notice = dom('.device-code-notice')!
    expect(notice.text()).toContain('ana@example.com')
    expect(notice.find('.device-code-notice__code').exists()).toBe(false)
  })

  it('reemitir un dispositivo revocado también es posible (es la forma de reactivarlo)', async () => {
    await mountView()
    await byLabel('Reemitir Perdido').trigger('click')
    await confirmAction()
    expect(reissue).toHaveBeenCalledExactlyOnceWith('d-4', {})
  })

  it('el dispositivo que se está usando: avisa que se va a desconectar', async () => {
    await mountView('socio', 'd-1')
    await byLabel('Reemitir Mostrador').trigger('click')
    expect(dom('.device-action-confirm')!.text()).toContain('el dispositivo que estás usando')
  })

  it('502: no cambió nada (el acceso actual sigue), el cuadro sigue abierto y la lista no se recarga', async () => {
    reissue.mockRejectedValue(failure(502))
    await mountView()
    await byLabel('Reemitir Tablet vieja').trigger('click')
    await confirmAction('ana@example.com')
    expect(alerts()).toEqual([VOICE.devices.emailFailed])
    expect(dom('.device-action-confirm')).not.toBeNull()
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('400 del correo: se marca en el campo', async () => {
    reissue.mockRejectedValue(failure(400, 'Escribe un correo válido, por ejemplo nombre@dominio.com'))
    await mountView()
    await byLabel('Reemitir Tablet vieja').trigger('click')
    await confirmAction('ana@example.com')
    expect(fieldErrors()).toEqual([VOICE.devices.badEmail])
  })

  it('404: cierra, lo dice y recarga la lista', async () => {
    reissue.mockRejectedValue(failure(404))
    await mountView()
    await byLabel('Reemitir Tablet vieja').trigger('click')
    await confirmAction()
    expect(dom('.device-action-confirm')).toBeNull()
    expect(alerts()).toContain(VOICE.devices.notFound)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('un aviso anterior se retira al empezar otra acción', async () => {
    await mountView()
    await byLabel('Reemitir Tablet vieja').trigger('click')
    await confirmAction()
    expect(dom('.device-code-notice')).not.toBeNull()
    await byLabel('Revocar Mostrador').trigger('click')
    expect(dom('.device-code-notice')).toBeNull()
  })
})
