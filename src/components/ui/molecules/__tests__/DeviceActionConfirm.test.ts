import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DeviceActionConfirm from '../DeviceActionConfirm.vue'

// attachTo: jsdom solo envía un formulario al hacer clic en su botón "submit" si
// el formulario está conectado al documento.
const mounted: Array<{ unmount: () => void }> = []
function mountConfirm(props: Record<string, unknown> = {}) {
  const wrapper = mount(DeviceActionConfirm, {
    attachTo: document.body,
    props: { action: 'revoke', deviceName: 'Tablet de Ana', ...props },
  })
  mounted.push(wrapper)
  return wrapper
}
afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})
type Wrapper = ReturnType<typeof mountConfirm>
const button = (w: Wrapper, text: string) => w.findAll('button').find((b) => b.text() === text)!
const CORREO = 'Enviar el código por correo (opcional)'

describe('DeviceActionConfirm — revocar', () => {
  it('nombra el dispositivo y explica el efecto: deja de poder usar la app de inmediato', () => {
    const w = mountConfirm()
    expect(w.text()).toContain('Tablet de Ana')
    expect(w.text()).toContain('de inmediato')
  })

  it('dice que se puede volver a activar reemitiendo (no es definitivo)', () => {
    expect(mountConfirm().text()).toContain('reemitir')
  })

  it('el botón de confirmar es de peligro y dice lo que hace; el de cancelar es "Mejor no"', () => {
    const w = mountConfirm()
    expect(button(w, 'Sí, revocar').classes()).toContain('app-btn--danger')
    expect(button(w, 'Mejor no')).toBeDefined()
  })

  it('no pide correo', () => {
    expect(mountConfirm().find('input').exists()).toBe(false)
  })

  it('confirmar emite confirm sin datos; cancelar emite cancel', async () => {
    const w = mountConfirm()
    await button(w, 'Sí, revocar').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([{}])
    await button(w, 'Mejor no').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})

describe('DeviceActionConfirm — reemitir', () => {
  const reissue = (over: Record<string, unknown> = {}) => mountConfirm({ action: 'reissue', ...over })

  it('explica: código nuevo de un solo uso y el acceso actual deja de funcionar', () => {
    const text = reissue().text()
    expect(text).toContain('código nuevo')
    expect(text).toContain('un solo uso')
    expect(text).toContain('dejará de funcionar')
  })

  it('ofrece un correo opcional para mandar el código', () => {
    const w = reissue()
    const label = w.findAll('label').find((l) => l.text() === CORREO)!
    expect(label).toBeDefined()
    expect(w.get(`#${label.attributes('for')}`).attributes('type')).toBe('email')
  })

  it('sin correo: confirm sin correoEnvio', async () => {
    const w = reissue()
    await button(w, 'Reemitir código').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([{}])
  })

  it('con correo válido: confirm con el correo recortado', async () => {
    const w = reissue()
    const label = w.findAll('label').find((l) => l.text() === CORREO)!
    await w.get(`#${label.attributes('for')}`).setValue('  ana@example.com ')
    await button(w, 'Reemitir código').trigger('click')
    expect(w.emitted('confirm')![0]).toEqual([{ correoEnvio: 'ana@example.com' }])
  })

  it('con correo inválido: no confirma y lo dice', async () => {
    const w = reissue()
    const label = w.findAll('label').find((l) => l.text() === CORREO)!
    await w.get(`#${label.attributes('for')}`).setValue('ana@')
    await button(w, 'Reemitir código').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
    expect(w.find('.app-input__error').text()).toBe('Escribe un correo válido, por ejemplo nombre@dominio.com')
  })

  it('el botón de confirmar es el principal (no de peligro)', () => {
    const confirm = button(reissue(), 'Reemitir código')
    expect(confirm.classes()).toContain('app-btn--primary')
    expect(confirm.classes()).not.toContain('app-btn--danger')
  })

  it('un error del servidor sobre el correo aparece en el campo', () => {
    const w = reissue({ serverErrors: { correoEnvio: 'Correo malo' } })
    expect(w.find('.app-input__error').text()).toBe('Correo malo')
  })
})

describe('DeviceActionConfirm — dispositivo en uso, carga y errores', () => {
  it.each(['revoke', 'reissue'])('%s: si es el dispositivo que se está usando, avisa que se va a desconectar', (action) => {
    const w = mountConfirm({ action, isCurrentDevice: true })
    expect(w.find('.app-alert--warning').exists()).toBe(true)
    expect(w.text()).toContain('el dispositivo que estás usando')
    expect(w.text()).toContain('desconect')
  })

  it.each(['revoke', 'reissue'])('%s: si no es el que se usa, no hay ese aviso', (action) => {
    expect(mountConfirm({ action }).find('.app-alert--warning').exists()).toBe(false)
  })

  it('con loading: botones deshabilitados y no confirma dos veces', async () => {
    const w = mountConfirm({ loading: true })
    expect(w.findAll('button').every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    await w.get('form').trigger('submit')
    expect(w.emitted('confirm')).toBeUndefined()
  })

  it('un error general se muestra en una alerta', () => {
    const w = mountConfirm({ error: 'No pudimos conectarnos.' })
    expect(w.find('[role="alert"]').text()).toContain('No pudimos conectarnos.')
  })

  it('confirmar también se puede con Enter (es un formulario)', async () => {
    const w = mountConfirm()
    await w.get('form').trigger('submit')
    expect(w.emitted('confirm')).toHaveLength(1)
  })
})
