import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TeamMemberList from '../TeamMemberList.vue'
import type { Member } from '@/types/member.types'

const members: Member[] = [
  { id: 'm-1', name: 'Ana Ruiz', role: 'socio', active: true },
  { id: 'm-2', name: 'Carlos Núñez', role: 'colaborador', active: true },
  { id: 'm-3', name: 'Beto Gil', role: 'colaborador', active: false },
]

const rows = (w: ReturnType<typeof mountList>) => w.findAll('li.team-list__item')
function mountList(props: Record<string, unknown> = {}) {
  return mount(TeamMemberList, { props: { members, ...props } })
}

describe('TeamMemberList', () => {
  it('es una lista con nombre accesible, una fila por persona y en el orden recibido', () => {
    const w = mountList()
    expect(w.get('ul').attributes('aria-label')).toBe('Personas del equipo')
    expect(rows(w).map((r) => r.get('.team-list__name').text())).toEqual(['Ana Ruiz', 'Carlos Núñez', 'Beto Gil'])
  })

  it('el rol se lee en texto (no solo por color): Socio / Colaborador', () => {
    const w = mountList()
    expect(rows(w).map((r) => r.get('.team-list__role').text())).toEqual(['Socio', 'Colaborador', 'Colaborador'])
  })

  it('una persona desactivada dice "Inactivo" en texto y se marca en la fila', () => {
    const w = mountList()
    expect(rows(w)[2].text()).toContain('Inactivo')
    expect(rows(w)[2].classes()).toContain('team-list__item--inactive')
    expect(rows(w)[0].text()).not.toContain('Inactivo')
    expect(rows(w)[0].classes()).not.toContain('team-list__item--inactive')
  })

  it('marca con "Tú" a la persona que tiene la sesión abierta', () => {
    const w = mountList({ currentMemberId: 'm-2' })
    expect(rows(w)[1].text()).toContain('Tú')
    expect(rows(w)[0].text()).not.toContain('Tú')
  })

  it('sin currentMemberId nadie lleva "Tú"', () => {
    expect(mountList().text()).not.toContain('Tú')
  })

  it('el avatar es decorativo: el nombre está en el texto', () => {
    const w = mountList()
    for (const avatar of w.findAll('.app-avatar')) expect(avatar.attributes('aria-hidden')).toBe('true')
  })

  it('sin personas muestra un mensaje en vez de una lista vacía', () => {
    const w = mountList({ members: [] })
    expect(w.find('ul').exists()).toBe(false)
    expect(w.text()).toContain('Todavía no hay personas en tu equipo.')
  })

  it('no muestra ids ni datos internos', () => {
    const text = mountList().text()
    expect(text).not.toContain('m-1')
  })
})

describe('TeamMemberList: cuentas personales de los socios', () => {
  const NOW = new Date('2026-10-20T18:00:00.000Z')
  const info = (over = {}) => ({
    email: 'beto@example.test', sentAt: '2026-10-20T17:50:00.000Z', expiresAt: '2026-10-23T17:50:00.000Z',
    canResendAt: '2026-10-20T17:51:00.000Z', resendsLeftToday: 2, ...over,
  })
  const socios: Member[] = [
    { id: 'm-1', name: 'Ana Ruiz', role: 'socio', active: true },
    { id: 'm-2', name: 'Beto Gil', role: 'socio', active: true },
    { id: 'm-3', name: 'Carla Paz', role: 'colaborador', active: true },
    { id: 'm-4', name: 'Dani Soto', role: 'socio', active: false },
  ]
  const YES = { allowed: true, reason: null }
  const NO = { allowed: false, reason: null }
  const status = (over: Record<string, unknown> = {}) => [
    { memberId: 'm-1', name: 'Ana Ruiz', hasPersonalAccount: true, invite: NO, invitation: null },
    { memberId: 'm-2', name: 'Beto Gil', hasPersonalAccount: false, invite: YES, invitation: null },
    ...(over.extra as unknown[] ?? []),
  ]
  const list = (invitations: unknown, extra: Record<string, unknown> = {}) =>
    mountList({ members: socios, invitations, now: NOW, ...extra })

  it('sin la información de invitaciones no muestra nada de cuentas (colaboradores, o aún cargando)', () => {
    const w = mountList({ members: socios })
    expect(w.text()).not.toContain('cuenta personal')
    expect(w.find('[data-test="invite"]').exists()).toBe(false)
  })

  it('el socio con cuenta lo dice y no ofrece invitar', () => {
    const w = list(status())
    expect(rows(w)[0].text()).toContain('Con cuenta personal')
    expect(rows(w)[0].find('[data-test="invite"]').exists()).toBe(false)
  })

  it('el socio sin cuenta ofrece "Invitar", con el nombre en su etiqueta accesible', () => {
    const w = list(status())
    const button = rows(w)[1].get('[data-test="invite"]')
    expect(rows(w)[1].text()).toContain('Sin cuenta personal')
    expect(button.text()).toBe('Invitar')
    expect(button.attributes('aria-label')).toBe('Invitar a Beto Gil')
  })

  it('un colaborador y un socio inactivo no muestran nada de cuenta, aunque el servidor los incluyera', () => {
    const w = list([
      ...status(),
      { memberId: 'm-3', name: 'Carla Paz', hasPersonalAccount: false, invite: YES, invitation: null },
      { memberId: 'm-4', name: 'Dani Soto', hasPersonalAccount: false, invite: YES, invitation: null },
    ])
    for (const index of [2, 3]) {
      expect(rows(w)[index].text()).not.toContain('cuenta personal')
      expect(rows(w)[index].find('[data-test="invite"]').exists()).toBe(false)
    }
  })

  it('tocar el botón avisa a qué socio', async () => {
    const w = list(status())
    await rows(w)[1].get('[data-test="invite"]').trigger('click')
    expect(w.emitted('invite')).toEqual([['m-2']])
  })

  it('con invitación vigente dice a quién se mandó y cuándo vence, y ofrece reenviar', () => {
    const w = list([status()[0], { memberId: 'm-2', name: 'Beto Gil', hasPersonalAccount: false, invite: YES, invitation: info() }])
    expect(rows(w)[1].get('[data-test="invite-status"]').text()).toBe('Invitación enviada a beto@example.test. Vence el 23/10/2026.')
    expect(rows(w)[1].get('[data-test="invite"]').text()).toBe('Reenviar invitación')
    expect(rows(w)[1].get('[data-test="invite"]').attributes('disabled')).toBeUndefined()
  })

  it('el reenvío espera un minuto o se agota por el día, y lo explica en texto', () => {
    const soon = list([status()[0], { memberId: 'm-2', name: 'Beto Gil', hasPersonalAccount: false, invite: YES, invitation: info({ canResendAt: '2026-10-20T18:00:30.000Z' }) }])
    expect(rows(soon)[1].get('[data-test="invite"]').attributes('disabled')).toBeDefined()
    expect(rows(soon)[1].get('[data-test="invite-hint"]').text()).toBe('Espera un minuto antes de reenviar.')

    const spent = list([status()[0], { memberId: 'm-2', name: 'Beto Gil', hasPersonalAccount: false, invite: YES, invitation: info({ resendsLeftToday: 0 }) }])
    expect(rows(spent)[1].get('[data-test="invite-hint"]').text()).toBe('Ya se enviaron 3 invitaciones hoy. Intenta mañana.')
  })

  describe('con acceso compartido: el botón no se oculta, queda deshabilitado con la explicación', () => {
    const BLOCKED = 'Tu acceso es compartido y ya hay cuentas personales. Pídele a un socio con cuenta personal que te invite.'
    const SELF_ONLY = 'Con el acceso compartido solo puedes invitar al socio que elegiste en este momento.'

    it('con cuentas personales existentes: botón visible, deshabilitado y con la razón en texto', () => {
      const w = list([status()[0], { memberId: 'm-2', name: 'Beto Gil', hasPersonalAccount: false, invite: { allowed: false, reason: BLOCKED }, invitation: null }])
      const button = rows(w)[1].get('[data-test="invite"]')
      expect(button.text()).toBe('Invitar')
      expect(button.attributes('disabled')).toBeDefined()
      expect(rows(w)[1].get('[data-test="invite-hint"]').text()).toBe(BLOCKED)
    })

    it('puede invitarse al socio elegido, pero no a otro, y a los otros se les explica por qué', () => {
      const w = list([
        { memberId: 'm-1', name: 'Ana Ruiz', hasPersonalAccount: false, invite: YES, invitation: null },
        { memberId: 'm-2', name: 'Beto Gil', hasPersonalAccount: false, invite: { allowed: false, reason: SELF_ONLY }, invitation: null },
      ])
      expect(rows(w)[0].get('[data-test="invite"]').attributes('disabled')).toBeUndefined()
      expect(rows(w)[1].get('[data-test="invite"]').attributes('disabled')).toBeDefined()
      expect(rows(w)[1].get('[data-test="invite-hint"]').text()).toBe(SELF_ONLY)
    })

    it('un botón deshabilitado no avisa al tocarlo', async () => {
      const w = list([status()[0], { memberId: 'm-2', name: 'Beto Gil', hasPersonalAccount: false, invite: { allowed: false, reason: BLOCKED }, invitation: null }])
      await rows(w)[1].get('[data-test="invite"]').trigger('click')
      expect(w.emitted('invite')).toBeUndefined()
    })

    it('la razón también aparece aunque haya una invitación vieja', () => {
      const w = list([status()[0], { memberId: 'm-2', name: 'Beto Gil', hasPersonalAccount: false, invite: { allowed: false, reason: BLOCKED }, invitation: info() }])
      expect(rows(w)[1].get('[data-test="invite-hint"]').text()).toBe(BLOCKED)
      expect(rows(w)[1].get('[data-test="invite"]').attributes('disabled')).toBeDefined()
    })
  })

  it('mientras se envía, los botones se bloquean', () => {
    const w = list(status(), { busy: true })
    expect(rows(w)[1].get('[data-test="invite"]').attributes('disabled')).toBeDefined()
  })
})
