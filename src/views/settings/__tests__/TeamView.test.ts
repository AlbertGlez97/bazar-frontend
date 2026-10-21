// Mi equipo (contenedor): componentes y stores REALES; solo se simula la red
// (MembersService). El cuadro del alta usa el Teleport REAL (el stub de
// @vue/test-utils vuelve a montar el formulario en cada re-render y borraría lo
// escrito), así que se consulta el DOM completo en `document.body`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import TeamView from '../TeamView.vue'
import MembersService from '@/services/members.service'
import { AccountInvitationsService } from '@/services/account-invitations.service'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { VOICE } from '@/config/voice'
import type { CreatedMember, Member } from '@/types/member.types'

vi.mock('@/services/members.service', () => ({ default: { list: vi.fn(), create: vi.fn() } }))
vi.mock('@/services/account-invitations.service', () => ({ AccountInvitationsService: { status: vi.fn(), invite: vi.fn() } }))
vi.mock('@/services/queue-origin', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  currentQueueOrigin: () => ({ accountId: 'a', memberId: 'm-1', deviceId: 'd', apiBase: '/api/v1' }),
}))
const list = vi.mocked(MembersService.list)
const create = vi.mocked(MembersService.create)
const inviteStatus = vi.mocked(AccountInvitationsService.status)
const sendInvite = vi.mocked(AccountInvitationsService.invite)

const TEAM: Member[] = [
  { id: 'm-1', name: 'Ana Ruiz', role: 'socio', active: true },
  { id: 'm-2', name: 'Carlos Núñez', role: 'colaborador', active: true },
  { id: 'm-3', name: 'Beto Gil', role: 'colaborador', active: false },
]
const CREATED: CreatedMember = {
  id: 'm-9', name: 'Diana Paz', role: 'colaborador', active: true, commissionRateBps: 1050,
  createdByMemberId: 'm-1', username: 'diana@example.com', credentialsEmail: 'member',
}

const mounted: Array<{ unmount: () => void }> = []

async function mountView(role: 'socio' | 'colaborador' = 'socio') {
  const session = useSessionStore()
  session.setMember({ id: 'm-1', name: 'Ana Ruiz', role, active: true })
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app', name: 'AppHome', component: stub },
      { path: '/app/ajustes', name: 'Settings', component: stub },
      { path: '/app/ajustes/equipo', name: 'Team', component: TeamView },
    ],
  })
  router.push('/app/ajustes/equipo')
  await router.isReady()
  const wrapper = mount(TeamView, { attachTo: document.body, global: { plugins: [router] } })
  mounted.push(wrapper)
  await flushPromises()
  return { wrapper, router, session }
}

// Todo se consulta en el documento: incluye lo que el Teleport lleva al <body>.
const dom = (selector: string) => {
  const el = document.body.querySelector(selector)
  return el ? new DOMWrapper(el) : null
}
const domAll = (selector: string) => Array.from(document.body.querySelectorAll(selector)).map((el) => new DOMWrapper(el))
const button = (text: string) => domAll('button').find((b) => b.text() === text)
const rows = () => domAll('li.team-list__item')
const alerts = () => domAll('[role="alert"]').map((a) => a.text())
const fieldErrors = () => domAll('.app-input__error, .app-select__error').map((e) => e.text())
const inputByLabel = (label: string) => {
  const l = domAll('label').find((x) => x.text() === label)!
  return dom(`#${l.attributes('for')}`)!
}
const inputValue = (label: string) => (inputByLabel(label).element as HTMLInputElement).value

async function openAndFill(over: { nombre?: string; apellidos?: string; correo?: string; commission?: string } = {}) {
  await button('Agregar persona')!.trigger('click')
  await inputByLabel('Nombre').setValue(over.nombre ?? 'Diana')
  await inputByLabel('Apellidos').setValue(over.apellidos ?? 'Paz')
  await inputByLabel('Correo').setValue(over.correo ?? 'diana@example.com')
  if (over.commission !== undefined) await inputByLabel('Comisión (%)').setValue(over.commission)
}
async function submitForm() {
  await dom('.member-create-form')!.trigger('submit')
  await flushPromises()
}
const failure = (status: number, message?: unknown) => ({ response: { status, data: { message } } })

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  list.mockReset().mockResolvedValue(TEAM)
  create.mockReset().mockResolvedValue(CREATED)
  inviteStatus.mockReset().mockResolvedValue([])
  sendInvite.mockReset()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
  document.body.innerHTML = ''
})

describe('TeamView — lista', () => {
  it('al abrir pide el equipo INCLUYENDO desactivados (es una pantalla de socios)', async () => {
    await mountView()
    expect(list).toHaveBeenCalledExactlyOnceWith({ includeInactive: true })
  })

  it('muestra el título, la lista con roles y "Inactivo", y marca "Tú" a quien tiene la sesión', async () => {
    await mountView()
    expect(dom('h1')!.text()).toBe('Mi equipo')
    expect(rows().map((r) => r.find('.team-list__name').text())).toEqual(['Ana Ruiz', 'Carlos Núñez', 'Beto Gil'])
    expect(rows()[2].text()).toContain('Inactivo')
    expect(rows()[0].text()).toContain('Tú')
  })

  it('mientras carga muestra un estado de carga (y no la lista)', async () => {
    let resolve!: (v: Member[]) => void
    list.mockReturnValue(new Promise<Member[]>((r) => { resolve = r }))
    await mountView()
    expect(dom('.team-view__loading')!.text()).toContain(VOICE.team.loading)
    expect(dom('.team-view__loading')!.attributes('role')).toBe('status')
    expect(rows()).toHaveLength(0)
    resolve(TEAM)
    await flushPromises()
    expect(rows()).toHaveLength(3)
  })

  it('si falla la carga: mensaje claro y "Intentar de nuevo", que vuelve a pedir', async () => {
    list.mockRejectedValueOnce(failure(500))
    await mountView()
    expect(alerts()).toEqual([VOICE.team.loadError])
    await button('Intentar de nuevo')!.trigger('click')
    await flushPromises()
    expect(list).toHaveBeenCalledTimes(2)
    expect(rows()).toHaveLength(3)
  })

  it('403 al cargar: dice que es solo para socios', async () => {
    list.mockRejectedValueOnce(failure(403))
    await mountView()
    expect(alerts()).toEqual([VOICE.team.forbidden])
  })

  it('sin red al cargar: mensaje de red', async () => {
    list.mockRejectedValueOnce(new Error('Network Error'))
    await mountView()
    expect(alerts()).toEqual([VOICE.networkError])
  })

  it('una respuesta vieja nunca pisa a la nueva (alta mientras la primera carga sigue en camino)', async () => {
    let resolveFirst!: (v: Member[]) => void
    const withDiana = [...TEAM, { id: 'm-9', name: 'Diana Paz', role: 'colaborador' as const, active: true }]
    list.mockReset()
      .mockReturnValueOnce(new Promise<Member[]>((r) => { resolveFirst = r }))
      .mockResolvedValueOnce(withDiana)
    await mountView() // la primera consulta sigue pendiente

    await openAndFill()
    await submitForm() // el alta recarga la lista y esa segunda respuesta llega primero
    expect(rows()).toHaveLength(4)

    resolveFirst(TEAM) // llega tarde, con la lista de antes del alta
    await flushPromises()
    expect(rows()).toHaveLength(4)
  })

  it('tiene un enlace para volver a ajustes', async () => {
    await mountView()
    expect(dom('a[href="/app/ajustes"]')!.text()).toContain('Volver a ajustes')
  })
})

describe('TeamView — permisos vivos', () => {
  it('si la persona deja de ser socio con la vista abierta, sale a Inicio', async () => {
    const { router, session } = await mountView()
    session.setMember({ id: 'm-2', name: 'Carlos Núñez', role: 'colaborador', active: true })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('AppHome')
  })
})

describe('TeamView — agregar persona', () => {
  it('"Agregar persona" abre el formulario en un cuadro con título y se puede cancelar', async () => {
    await mountView()
    expect(dom('.member-create-form')).toBeNull()
    await button('Agregar persona')!.trigger('click')
    expect(dom('[role="dialog"]')).not.toBeNull()
    expect(dom('.app-modal__title')!.text()).toBe('Agregar persona')
    await button('Cancelar')!.trigger('click')
    expect(dom('.member-create-form')).toBeNull()
  })

  it('éxito: envía el cuerpo con los puntos base, cierra el cuadro, confirma y recarga la lista', async () => {
    await mountView()
    await openAndFill({ commission: '10.5' })
    await submitForm()

    expect(create).toHaveBeenCalledExactlyOnceWith({
      nombre: 'Diana', apellidos: 'Paz', correo: 'diana@example.com', role: 'colaborador', commissionRateBps: 1050,
    })
    expect(dom('.member-create-form')).toBeNull()
    const notice = dom('.member-created-notice')!
    expect(notice.text()).toContain('Diana Paz')
    expect(notice.text()).toContain('diana@example.com')
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('el aviso muestra el correo que se escribió y el usuario que devolvió el servidor', async () => {
    create.mockResolvedValue({ ...CREATED, username: 'diana.paz' })
    await mountView()
    await openAndFill({ correo: 'contacto@example.com' })
    await submitForm()
    const text = dom('.member-created-notice')!.text()
    expect(text).toContain('contacto@example.com')
    expect(text).toContain('diana.paz')
  })

  it('correo en modo de prueba (approver-fallback): aviso honesto, no de éxito', async () => {
    create.mockResolvedValue({ ...CREATED, credentialsEmail: 'approver-fallback' })
    await mountView()
    await openAndFill()
    await submitForm()
    const notice = dom('.member-created-notice')!
    expect(notice.find('.app-alert--warning').exists()).toBe(true)
    expect(notice.find('.app-alert--success').exists()).toBe(false)
    expect(notice.text()).toContain('modo de prueba')
  })

  it('"Entendido" retira el aviso', async () => {
    await mountView()
    await openAndFill()
    await submitForm()
    await button('Entendido')!.trigger('click')
    expect(dom('.member-created-notice')).toBeNull()
  })

  it('un socio nuevo se envía sin commissionRateBps', async () => {
    create.mockResolvedValue({ ...CREATED, role: 'socio', commissionRateBps: null })
    await mountView()
    await button('Agregar persona')!.trigger('click')
    await inputByLabel('Rol').setValue('socio')
    await inputByLabel('Nombre').setValue('Diana')
    await inputByLabel('Apellidos').setValue('Paz')
    await inputByLabel('Correo').setValue('diana@example.com')
    await submitForm()
    const sent = create.mock.calls[0][0] as unknown as Record<string, unknown>
    expect(sent.role).toBe('socio')
    expect('commissionRateBps' in sent).toBe(false)
  })

  it('al volver a abrir el cuadro, el formulario está vacío (no quedan datos de la persona anterior)', async () => {
    await mountView()
    await openAndFill()
    await submitForm()
    await button('Agregar persona')!.trigger('click')
    expect(inputValue('Nombre')).toBe('')
  })

  it('un aviso anterior se retira al iniciar otro alta', async () => {
    await mountView()
    await openAndFill()
    await submitForm()
    expect(dom('.member-created-notice')).not.toBeNull()
    await button('Agregar persona')!.trigger('click')
    expect(dom('.member-created-notice')).toBeNull()
  })

  it('si la lista no se pudo recargar tras crear, el aviso de éxito sigue a la vista y hay reintento', async () => {
    await mountView()
    list.mockRejectedValueOnce(failure(500))
    await openAndFill()
    await submitForm()
    expect(dom('.member-created-notice')).not.toBeNull()
    expect(alerts()).toContain(VOICE.team.loadError)
    expect(button('Intentar de nuevo')).toBeDefined()
  })

  it('la lista sigue a la vista mientras se recarga tras el alta (sin volver al esqueleto)', async () => {
    await mountView()
    let resolve!: (v: Member[]) => void
    list.mockReturnValueOnce(new Promise<Member[]>((r) => { resolve = r }))
    await openAndFill()
    await submitForm()
    expect(dom('.team-view__loading')).toBeNull()
    expect(rows()).toHaveLength(3)
    resolve([...TEAM, { id: 'm-9', name: 'Diana Paz', role: 'colaborador', active: true }])
    await flushPromises()
    expect(rows()).toHaveLength(4)
  })
})

describe('TeamView — errores al agregar', () => {
  it('400 con el correo mal: se marca en el campo, el cuadro sigue abierto y lo escrito se conserva', async () => {
    create.mockRejectedValue(failure(400, 'Escribe un correo válido, por ejemplo nombre@dominio.com'))
    await mountView()
    await openAndFill()
    await submitForm()
    expect(fieldErrors()).toEqual([VOICE.team.badEmail])
    expect(dom('.member-create-form')).not.toBeNull()
    expect(inputValue('Nombre')).toBe('Diana')
    expect(dom('.member-created-notice')).toBeNull()
  })

  it('400 sin campo reconocible: mensaje general amable', async () => {
    create.mockRejectedValue(failure(400, 'role must be one of the following values'))
    await mountView()
    await openAndFill()
    await submitForm()
    expect(alerts()).toEqual([VOICE.team.createInvalid])
  })

  it('403: solo un socio puede agregar personas', async () => {
    create.mockRejectedValue(failure(403))
    await mountView()
    await openAndFill()
    await submitForm()
    expect(alerts()).toEqual([VOICE.team.createForbidden])
  })

  it('409: no se pudo asignar un usuario; se puede reintentar sin volver a escribir', async () => {
    create.mockRejectedValueOnce(failure(409)).mockResolvedValueOnce(CREATED)
    await mountView()
    await openAndFill()
    await submitForm()
    expect(alerts()).toEqual([VOICE.team.createUsername])
    await submitForm()
    expect(create).toHaveBeenCalledTimes(2)
    expect(dom('.member-created-notice')).not.toBeNull()
  })

  it('502: "no se creó" y se puede reintentar; la lista NO se recarga (no cambió nada)', async () => {
    create.mockRejectedValue(failure(502))
    await mountView()
    await openAndFill()
    await submitForm()
    expect(alerts()).toEqual([VOICE.team.createEmailFailed])
    expect(alerts()[0]).toMatch(/no se creó/i)
    expect(list).toHaveBeenCalledTimes(1)
    expect(dom('.member-created-notice')).toBeNull()
  })

  it('sin red: mensaje de red', async () => {
    create.mockRejectedValue(new Error('Network Error'))
    await mountView()
    await openAndFill()
    await submitForm()
    expect(alerts()).toEqual([VOICE.networkError])
  })

  it('un error viejo se retira al reenviar', async () => {
    create.mockRejectedValueOnce(failure(502)).mockResolvedValueOnce(CREATED)
    await mountView()
    await openAndFill()
    await submitForm()
    expect(alerts()).toEqual([VOICE.team.createEmailFailed])
    await submitForm()
    expect(alerts().filter((a) => a === VOICE.team.createEmailFailed)).toHaveLength(0)
  })
})

describe('TeamView — envío en curso', () => {
  it('mientras espera: el formulario queda deshabilitado y un segundo envío no repite la llamada', async () => {
    let resolve!: (v: CreatedMember) => void
    create.mockReturnValue(new Promise<CreatedMember>((r) => { resolve = r }))
    await mountView()
    await openAndFill()
    await submitForm()

    expect(dom('.member-create-form button[type="submit"]')!.attributes('disabled')).toBeDefined()
    await submitForm()
    expect(create).toHaveBeenCalledTimes(1)

    resolve(CREATED)
    await flushPromises()
    expect(dom('.member-created-notice')).not.toBeNull()
  })

  it('mientras espera no se puede cerrar el cuadro (Escape ni "Cancelar")', async () => {
    let resolve!: (v: CreatedMember) => void
    create.mockReturnValue(new Promise<CreatedMember>((r) => { resolve = r }))
    await mountView()
    await openAndFill()
    await submitForm()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(dom('.member-create-form')).not.toBeNull()

    resolve(CREATED)
    await flushPromises()
    expect(dom('.member-create-form')).toBeNull()
  })

  it('con una validación de cliente fallida no se llama al servidor', async () => {
    await mountView()
    await openAndFill({ correo: 'sin-arroba' })
    await submitForm()
    expect(create).not.toHaveBeenCalled()
  })
})

describe('TeamView — invitar a un socio a crear su cuenta', () => {
  const ELENA = { id: '0190aaaa-0000-7000-8000-000000000005', name: 'Elena Mora', role: 'socio', active: true } as Member
  const info = (over = {}) => ({
    // Fechas ya pasadas respecto del reloj real: el botón de reenviar está habilitado.
    email: 'elena@example.test', sentAt: '2026-10-01T17:50:00.000Z', expiresAt: '2036-10-04T17:50:00.000Z',
    canResendAt: '2026-10-01T17:51:00.000Z', resendsLeftToday: 2, ...over,
  })
  const withElena = (invitation: ReturnType<typeof info> | null = null) => {
    list.mockResolvedValue([...TEAM, ELENA])
    inviteStatus.mockResolvedValue([
      { memberId: 'm-1', name: 'Ana Ruiz', hasPersonalAccount: true, invite: { allowed: false, reason: null }, invitation: null },
      { memberId: ELENA.id, name: ELENA.name, hasPersonalAccount: false, invite: { allowed: true, reason: null }, invitation },
    ])
  }
  const inviteButton = () => dom('[data-test="invite"]')!

  async function mountAsSocio() {
    useAuthStore().$patch({ token: 't' })
    return mountView()
  }

  it('con acceso compartido y cuentas personales existentes, el botón sigue visible pero deshabilitado con la explicación', async () => {
    const reason = 'Tu acceso es compartido y ya hay cuentas personales. Pídele a un socio con cuenta personal que te invite.'
    list.mockResolvedValue([...TEAM, ELENA])
    inviteStatus.mockResolvedValue([
      { memberId: 'm-1', name: 'Ana Ruiz', hasPersonalAccount: true, invite: { allowed: false, reason: null }, invitation: null },
      { memberId: ELENA.id, name: ELENA.name, hasPersonalAccount: false, invite: { allowed: false, reason }, invitation: null },
    ])
    await mountAsSocio()

    expect(inviteButton().text()).toBe('Invitar')
    expect(inviteButton().attributes('disabled')).toBeDefined()
    expect(dom('[data-test="invite-hint"]')!.text()).toBe(reason)
    await inviteButton().trigger('click')
    expect(dom('[role="dialog"]')).toBeNull()
    expect(sendInvite).not.toHaveBeenCalled()
  })

  it('pide el estado de las cuentas al abrir y lo muestra junto a cada socio', async () => {
    withElena()
    await mountAsSocio()
    expect(inviteStatus).toHaveBeenCalledTimes(1)
    expect(rows()[0].text()).toContain('Con cuenta personal')
    expect(rows()[3].text()).toContain('Sin cuenta personal')
  })

  it('"Invitar" abre un cuadro con el nombre, pide el correo y lo manda; luego avisa a dónde fue', async () => {
    withElena()
    sendInvite.mockResolvedValue({ expiresAt: '2026-10-23T17:50:00.000Z' })
    await mountAsSocio()
    await inviteButton().trigger('click')

    expect(dom('[role="dialog"]')!.text()).toContain('Invitar a Elena Mora')
    await inputByLabel('Correo de la persona').setValue('ELENA@example.test')
    await dom('.invite-form')!.trigger('submit')
    await flushPromises()

    expect(sendInvite).toHaveBeenCalledWith(expect.objectContaining({ memberId: 'm-1' }), ELENA.id, 'elena@example.test')
    expect(dom('[role="dialog"]')).toBeNull()
    expect(dom('[data-test="invite-sent"]')!.text()).toBe('Listo. Le mandamos la invitación a elena@example.test. El enlace dura 72 horas.')
    expect(inviteStatus).toHaveBeenCalledTimes(2)
  })

  it('si el servidor rechaza, el cuadro sigue abierto con el mensaje y no dice que se envió', async () => {
    withElena()
    sendInvite.mockRejectedValue({ response: { status: 422, data: { code: 'INVITATION_NOT_SENT', message: 'No pudimos enviar la invitación a ese correo.' } } })
    await mountAsSocio()
    await inviteButton().trigger('click')
    await inputByLabel('Correo de la persona').setValue('elena@example.test')
    await dom('.invite-form')!.trigger('submit')
    await flushPromises()

    expect(dom('[role="dialog"]')).not.toBeNull()
    expect(dom('.invite-form')!.text()).toContain('No pudimos enviar la invitación a ese correo.')
    expect(dom('[data-test="invite-sent"]')).toBeNull()
  })

  it('reenviar parte del correo de la invitación anterior', async () => {
    withElena(info())
    await mountAsSocio()
    expect(inviteButton().text()).toBe('Reenviar invitación')
    await inviteButton().trigger('click')
    await flushPromises()
    expect(inputValue('Correo de la persona')).toBe('elena@example.test')
    expect(dom('.invite-form button[type="submit"]')!.text()).toBe('Reenviar invitación')
  })

  it('cancelar cierra el cuadro sin enviar nada', async () => {
    withElena()
    await mountAsSocio()
    await inviteButton().trigger('click')
    await button('Cancelar')!.trigger('click')
    expect(dom('[role="dialog"]')).toBeNull()
    expect(sendInvite).not.toHaveBeenCalled()
  })

  it('un aviso de envío anterior se retira al abrir otra invitación', async () => {
    withElena()
    sendInvite.mockResolvedValue({ expiresAt: '2026-10-23T17:50:00.000Z' })
    await mountAsSocio()
    await inviteButton().trigger('click')
    await inputByLabel('Correo de la persona').setValue('elena@example.test')
    await dom('.invite-form')!.trigger('submit')
    await flushPromises()
    expect(dom('[data-test="invite-sent"]')).not.toBeNull()
    await inviteButton().trigger('click')
    expect(dom('[data-test="invite-sent"]')).toBeNull()
  })
})
