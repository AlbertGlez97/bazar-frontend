import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DeviceCodeNotice from '../DeviceCodeNotice.vue'

const CODE = '0190a5f0-7c3e-7000-8000-000000000001'

function mountNotice(props: Record<string, unknown> = {}) {
  return mount(DeviceCodeNotice, {
    props: { deviceName: 'Tablet de Ana', identifier: CODE, action: 'created', ...props },
  })
}

describe('DeviceCodeNotice — el código se muestra (sin correo)', () => {
  it('muestra el código de un solo uso y el nombre exacto que hay que escribir con él', () => {
    const w = mountNotice()
    expect(w.get('.device-code-notice__code').text()).toBe(CODE)
    expect(w.text()).toContain('Tablet de Ana')
    expect(w.text()).toContain('una sola vez')
    expect(w.text()).toContain('exactamente')
  })

  it('el código es seleccionable a mano (un elemento <code> con tabindex, para poder copiarlo si falla el botón)', () => {
    const code = mountNotice().get('.device-code-notice__code')
    expect(code.element.tagName).toBe('CODE')
    expect(code.attributes('tabindex')).toBe('0')
  })

  it('registrado: "Listo, registramos…"; reemitido: avisa que el acceso anterior dejó de funcionar', () => {
    expect(mountNotice({ action: 'created' }).text()).toContain('registramos')
    const reissued = mountNotice({ action: 'reissued' })
    expect(reissued.text()).toContain('código nuevo')
    expect(reissued.text()).toContain('dejó de funcionar')
  })

  it('es un aviso de éxito', () => {
    expect(mountNotice().find('.app-alert--success').exists()).toBe(true)
  })

  it('"Copiar código" emite copy y es un botón real con nombre accesible', async () => {
    const w = mountNotice()
    const button = w.findAll('button').find((b) => b.text() === 'Copiar código')!
    expect(button.attributes('type')).toBe('button')
    await button.trigger('click')
    expect(w.emitted('copy')).toHaveLength(1)
  })

  it('el resultado de copiar se anuncia con un estado vivo (role="status")', () => {
    const copied = mountNotice({ copyState: 'copied' })
    expect(copied.get('[role="status"]').text()).toBe('Código copiado.')
    const failed = mountNotice({ copyState: 'failed' })
    expect(failed.get('[role="status"]').text()).toContain('No pudimos copiarlo')
    expect(failed.get('[role="status"]').text()).toContain('a mano')
    expect(mountNotice({ copyState: 'idle' }).find('[role="status"]').exists()).toBe(false)
  })

  it('"Entendido" emite dismiss', async () => {
    const w = mountNotice()
    await w.findAll('button').find((b) => b.text() === 'Entendido')!.trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })
})

describe('DeviceCodeNotice — el código salió por correo (no hay código que mostrar)', () => {
  const emailed = (over: Record<string, unknown> = {}) =>
    mountNotice({ identifier: null, deliveredTo: 'recipient', correo: 'ana@example.com', ...over })

  it('confirma adónde fue y NO muestra ningún código ni botón de copiar', () => {
    const w = emailed()
    expect(w.text()).toContain('ana@example.com')
    expect(w.text()).toContain('Tablet de Ana')
    expect(w.find('.device-code-notice__code').exists()).toBe(false)
    expect(w.findAll('button').some((b) => b.text() === 'Copiar código')).toBe(false)
    expect(w.find('.app-alert--success').exists()).toBe(true)
  })

  it('approver-fallback: advertencia honesta de que NO llegó a la persona', () => {
    const w = emailed({ deliveredTo: 'approver-fallback' })
    expect(w.find('.app-alert--warning').exists()).toBe(true)
    expect(w.find('.app-alert--success').exists()).toBe(false)
    expect(w.text()).toContain('modo de prueba')
    expect(w.text()).toContain('no llegó')
    expect(w.text()).toContain('persona que aprueba')
  })

  it('reemitido por correo: dice que el acceso anterior dejó de funcionar', () => {
    expect(emailed({ action: 'reissued' }).text()).toContain('dejó de funcionar')
  })

  it('"Entendido" también cierra este aviso', async () => {
    const w = emailed()
    await w.findAll('button').find((b) => b.text() === 'Entendido')!.trigger('click')
    expect(w.emitted('dismiss')).toHaveLength(1)
  })
})
