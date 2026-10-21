import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import InviteMemberForm from '../InviteMemberForm.vue'

const mountIt = (props: Record<string, unknown> = {}) => mount(InviteMemberForm, { props: { memberName: 'Beto', ...props } })
const send = async (w: ReturnType<typeof mountIt>, value: string) => {
  await w.get('input[name="email"]').setValue(value)
  await w.get('form').trigger('submit')
}

describe('InviteMemberForm', () => {
  it('explica que el enlace sirve una vez, dura 72 horas y que la persona elige su contraseña', () => {
    const text = mountIt().text()
    expect(text).toContain('Beto elige su propia contraseña')
    expect(text).toContain('una sola vez')
    expect(text).toContain('72 horas')
  })

  it('el campo tiene etiqueta, id y autocompletado de correo', () => {
    const w = mountIt()
    const input = w.get('input[name="email"]')
    expect(input.attributes('autocomplete')).toBe('email')
    expect(w.find(`label[for="${input.attributes('id')}"]`).text()).toBe('Correo de la persona')
  })

  it('envía el correo limpio y en minúsculas', async () => {
    const w = mountIt()
    await send(w, '  BETO@Example.test ')
    expect(w.emitted('submit')).toEqual([['beto@example.test']])
  })

  it.each(['', 'sin-arroba', 'a@b', 'a b@c.com', 'a@b.com, c@d.com', '<a@b.com>', `${'x'.repeat(95)}@e.com`])('no envía %j', async (bad) => {
    const w = mountIt()
    await send(w, bad)
    expect(w.emitted('submit')).toBeUndefined()
    expect(w.text()).toContain('Escribe un solo correo, bien escrito.')
  })

  it('reenviar parte del correo anterior y cambia el texto del botón', () => {
    const w = mountIt({ initialEmail: 'beto@example.test', resend: true })
    expect((w.get('input[name="email"]').element as HTMLInputElement).value).toBe('beto@example.test')
    expect(w.get('button[type="submit"]').text()).toBe('Reenviar invitación')
    expect(mountIt().get('button[type="submit"]').text()).toBe('Enviar invitación')
  })

  it('muestra el error del servidor y bloquea mientras envía', () => {
    const w = mountIt({ error: 'No pudimos enviar la invitación a ese correo.', loading: true })
    expect(w.text()).toContain('No pudimos enviar la invitación a ese correo.')
    expect(w.get('input[name="email"]').attributes('disabled')).toBeDefined()
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('cancelar avisa a quien lo usa', async () => {
    const w = mountIt()
    await w.get('button[type="button"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
