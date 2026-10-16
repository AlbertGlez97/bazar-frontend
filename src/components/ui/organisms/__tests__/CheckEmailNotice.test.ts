import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CheckEmailNotice from '../CheckEmailNotice.vue'

const base = { correo: 'ana@example.com', secondsLeft: 0, resending: false, message: '' }
const buttonByText = (wrapper: ReturnType<typeof mount>, text: string) =>
  wrapper.findAll('button').find((b) => b.text().startsWith(text))

describe('CheckEmailNotice', () => {
  it('dice qué hacer: abrir el enlace y tocar "Confirmar mi correo", con el correo a la vista', () => {
    const wrapper = mount(CheckEmailNotice, { props: base })

    expect(wrapper.get('h1').text()).toBe('Revisa tu correo')
    expect(wrapper.text()).toContain('ana@example.com')
    expect(wrapper.text()).toContain('Confirmar mi correo')
  })

  it('recuerda revisar también el correo no deseado y que el enlace vence en 48 horas', () => {
    const text = mount(CheckEmailNotice, { props: base }).text()

    expect(text).toMatch(/correo no deseado/i)
    expect(text).toContain('48 horas')
  })

  it('aclara que hasta confirmar nadie revisa la solicitud', () => {
    expect(mount(CheckEmailNotice, { props: base }).text()).toMatch(/hasta que confirmes/i)
  })

  it('el botón "Reenviar correo" emite resend cuando ya se puede', async () => {
    const wrapper = mount(CheckEmailNotice, { props: base })

    await buttonByText(wrapper, 'Reenviar correo')!.trigger('click')

    expect(wrapper.emitted('resend')).toHaveLength(1)
  })

  it('con cuenta regresiva activa se desactiva y muestra los segundos que faltan', async () => {
    const wrapper = mount(CheckEmailNotice, { props: { ...base, secondsLeft: 42 } })
    const button = buttonByText(wrapper, 'Reenviar correo')!

    expect(button.text()).toBe('Reenviar correo en 42 s')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('resend')).toBeUndefined()
  })

  it('mientras reenvía, el botón está ocupado y no se puede pulsar otra vez', () => {
    const wrapper = mount(CheckEmailNotice, { props: { ...base, resending: true } })

    // con el spinner puesto el botón no muestra texto: es el primero
    expect(wrapper.findAll('button')[0].attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button')[0].classes()).toContain('app-btn--loading')
  })

  it('el resultado del reenvío se anuncia en una región de estado (lectores de pantalla)', () => {
    const wrapper = mount(CheckEmailNotice, { props: { ...base, message: 'Listo, te mandamos otro correo.' } })

    const status = wrapper.get('[role="status"]')
    expect(status.text()).toBe('Listo, te mandamos otro correo.')
    expect(status.attributes('aria-live')).toBe('polite')
  })

  it('la región de estado existe siempre (para que se anuncie el cambio) aunque esté vacía', () => {
    expect(mount(CheckEmailNotice, { props: base }).find('[role="status"]').exists()).toBe(true)
  })

  it('permite corregir el correo', async () => {
    const wrapper = mount(CheckEmailNotice, { props: base })

    await buttonByText(wrapper, 'Corregir mi correo')!.trigger('click')

    expect(wrapper.emitted('change-email')).toHaveLength(1)
  })

  it('el correo se muestra como texto, nunca como HTML', () => {
    const wrapper = mount(CheckEmailNotice, { props: { ...base, correo: '<img src=x onerror=alert(1)>@a.com' } })

    expect(wrapper.find('img').exists()).toBe(false)
  })
})
