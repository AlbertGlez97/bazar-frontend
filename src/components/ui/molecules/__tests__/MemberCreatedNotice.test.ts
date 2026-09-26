import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MemberCreatedNotice from '../MemberCreatedNotice.vue'
import type { CreatedMember } from '@/types/member.types'

const created = (over: Partial<CreatedMember> = {}): CreatedMember => ({
  id: 'm-9', name: 'Carlos Núñez', role: 'colaborador', active: true, commissionRateBps: 1050,
  createdByMemberId: 'm-1', username: 'carlos@example.com', credentialsEmail: 'member', ...over,
})

function mountNotice(over: Partial<CreatedMember> = {}, correo = 'carlos@example.com') {
  return mount(MemberCreatedNotice, { props: { created: created(over), correo } })
}

describe('MemberCreatedNotice — el correo salió a la persona', () => {
  it('confirma con hechos: a quién se agregó, adónde se mandó el correo y con qué usuario entra', () => {
    const w = mountNotice()
    const text = w.text()
    expect(text).toContain('Carlos Núñez')
    expect(text).toContain('carlos@example.com')
    expect(text).toMatch(/correo/i)
    expect(text).toContain('contraseña temporal')
    expect(text).toContain('Su usuario es')
  })

  it('es un aviso de éxito, no de advertencia', () => {
    const w = mountNotice()
    expect(w.find('.app-alert--success').exists()).toBe(true)
    expect(w.find('.app-alert--warning').exists()).toBe(false)
  })

  it('dice que el correo salió al correo que se escribió, aunque el usuario sea otro', () => {
    const w = mountNotice({ username: 'carlos.nunez' }, 'contacto@example.com')
    expect(w.text()).toContain('contacto@example.com')
    expect(w.text()).toContain('carlos.nunez')
  })

  it('nunca muestra una contraseña (el servidor no la devuelve)', () => {
    const w = mountNotice()
    expect(w.text()).not.toMatch(/contraseña:\s*\S+/i)
    expect(w.html()).not.toMatch(/password/i)
  })

  it('con comisión, la dice en porcentaje; sin comisión, dice que usa la general', () => {
    expect(mountNotice({ commissionRateBps: 1050 }).text()).toContain('10.5 %')
    expect(mountNotice({ commissionRateBps: null }).text()).toContain('comisión general')
  })

  it('un socio no muestra comisión', () => {
    const w = mountNotice({ role: 'socio', commissionRateBps: null })
    expect(w.text()).not.toContain('comisión')
    expect(w.text()).toContain('Socio')
  })
})

describe('MemberCreatedNotice — el correo NO llegó a la persona (modo de prueba)', () => {
  const fallback = () => mountNotice({ credentialsEmail: 'approver-fallback' })

  it('es un aviso de advertencia y lo dice con honestidad', () => {
    const w = fallback()
    expect(w.find('.app-alert--warning').exists()).toBe(true)
    expect(w.find('.app-alert--success').exists()).toBe(false)
    expect(w.text()).toContain('modo de prueba')
    expect(w.text()).toContain('no llegó')
  })

  it('no afirma que el correo se envió a la persona', () => {
    const w = fallback()
    expect(w.text()).not.toContain('Enviamos un correo a carlos@example.com')
    expect(w.text()).toContain('persona que aprueba')
  })

  it('sigue dando el usuario, para poder pasárselo', () => {
    expect(fallback().text()).toContain('carlos@example.com')
    expect(mountNotice({ credentialsEmail: 'approver-fallback', username: 'carlos.nunez' }).text()).toContain('carlos.nunez')
  })
})

describe('MemberCreatedNotice — cerrar', () => {
  it('"Entendido" emite dismiss y es un botón real', async () => {
    const w = mountNotice()
    const button = w.findAll('button').find((b) => b.text() === 'Entendido')!
    expect(button.attributes('type')).toBe('button')
    await button.trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })

  it('el aviso se anuncia a lectores de pantalla (role="alert")', () => {
    expect(mountNotice().find('[role="alert"]').exists()).toBe(true)
  })
})
