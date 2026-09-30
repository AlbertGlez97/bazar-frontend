import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChangePasswordForm from '../ChangePasswordForm.vue'

const CURRENT = 'la-de-hoy-123'
const NEW = 'la-de-manana-456'

type Wrapper = ReturnType<typeof mountForm>
function mountForm(props: Record<string, unknown> = {}) {
  return mount(ChangePasswordForm, { props })
}

const inputs = (w: Wrapper) => w.findAll('input')
async function fill(w: Wrapper, current: string, next: string, confirm: string) {
  const [c, n, r] = inputs(w)
  await c.setValue(current)
  await n.setValue(next)
  await r.setValue(confirm)
}
const submit = (w: Wrapper) => w.find('form').trigger('submit')
const errors = (w: Wrapper) => w.findAll('.app-input__error').map((e) => e.text())

afterEach(() => vi.restoreAllMocks())

describe('ChangePasswordForm — estructura y accesibilidad', () => {
  it('tiene tres campos de contraseña con su etiqueta y el autocompletado correcto', () => {
    const w = mountForm()
    const fields = inputs(w)
    expect(fields).toHaveLength(3)
    expect(w.findAll('label').map((l) => l.text())).toEqual([
      'Contraseña actual', 'Contraseña nueva', 'Confirma la contraseña nueva',
    ])
    expect(fields.map((f) => f.attributes('type'))).toEqual(['password', 'password', 'password'])
    expect(fields.map((f) => f.attributes('autocomplete'))).toEqual(['current-password', 'new-password', 'new-password'])
  })

  it('cada etiqueta apunta a su campo (for/id)', () => {
    const w = mountForm()
    const labels = w.findAll('label')
    const fields = inputs(w)
    labels.forEach((label, i) => expect(label.attributes('for')).toBe(fields[i].attributes('id')))
  })

  it('el botón de guardar es de envío y dice qué hace', () => {
    const w = mountForm()
    const button = w.find('button[type="submit"]')
    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('Guardar contraseña nueva')
  })

  it('mostrar/ocultar: un interruptor con aria-pressed que cambia el tipo de los tres campos', async () => {
    const w = mountForm()
    const toggle = w.find('button[aria-pressed]')
    expect(toggle.text()).toBe('Mostrar contraseñas')
    expect(toggle.attributes('aria-pressed')).toBe('false')
    expect(toggle.attributes('type')).toBe('button')

    await toggle.trigger('click')
    expect(toggle.text()).toBe('Ocultar contraseñas')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    expect(inputs(w).map((f) => f.attributes('type'))).toEqual(['text', 'text', 'text'])

    await toggle.trigger('click')
    expect(inputs(w).map((f) => f.attributes('type'))).toEqual(['password', 'password', 'password'])
  })

  it('mostrar/ocultar no envía el formulario', async () => {
    const w = mountForm()
    await w.find('button[aria-pressed]').trigger('click')
    expect(w.emitted('submit')).toBeUndefined()
  })
})

describe('ChangePasswordForm — validación de cliente', () => {
  it('con todo vacío no envía y explica qué falta', async () => {
    const w = mountForm()
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual([
      'Escribe tu contraseña actual.',
      'Escribe la contraseña nueva.',
      'Confirma la contraseña nueva.',
    ])
  })

  it('menos de 10 caracteres: no envía', async () => {
    const w = mountForm()
    await fill(w, CURRENT, 'corta-123', 'corta-123')
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['Usa entre 10 y 128 caracteres.'])
  })

  it('exactamente 10 caracteres es válido', async () => {
    const w = mountForm()
    await fill(w, CURRENT, '1234567890', '1234567890')
    await submit(w)
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it('exactamente 128 caracteres es válido y 129 no', async () => {
    const ok = 'a'.repeat(128)
    const w = mountForm()
    await fill(w, CURRENT, ok, ok)
    await submit(w)
    expect(w.emitted('submit')).toHaveLength(1)

    const tooLong = 'a'.repeat(129)
    const w2 = mountForm()
    await fill(w2, CURRENT, tooLong, tooLong)
    await submit(w2)
    expect(w2.emitted('submit')).toBeUndefined()
    expect(errors(w2)).toEqual(['Usa entre 10 y 128 caracteres.'])
  })

  it('igual a la actual: no envía', async () => {
    const w = mountForm()
    await fill(w, CURRENT, CURRENT, CURRENT)
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['La contraseña nueva debe ser distinta a la actual.'])
  })

  it('la confirmación no coincide: no envía', async () => {
    const w = mountForm()
    await fill(w, CURRENT, NEW, `${NEW}x`)
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['Las contraseñas no coinciden.'])
  })

  it('las contraseñas no se recortan: los espacios cuentan', async () => {
    const w = mountForm()
    await fill(w, CURRENT, `  ${NEW}  `, `  ${NEW}  `)
    await submit(w)
    expect(w.emitted('submit')![0]).toEqual([{ currentPassword: CURRENT, newPassword: `  ${NEW}  ` }])
  })

  it('los campos con error se marcan como inválidos y apuntan a su mensaje', async () => {
    const w = mountForm()
    await submit(w)
    for (const field of inputs(w)) {
      expect(field.attributes('aria-invalid')).toBe('true')
      expect(field.attributes('aria-describedby')).toContain(`${field.attributes('id')}-error`)
    }
  })

  it('al corregir y volver a enviar, los errores desaparecen', async () => {
    const w = mountForm()
    await submit(w)
    await fill(w, CURRENT, NEW, NEW)
    await submit(w)
    expect(errors(w)).toEqual([])
    expect(w.emitted('submit')).toHaveLength(1)
  })
})

describe('ChangePasswordForm — envío', () => {
  it('emite solo { currentPassword, newPassword } (la confirmación no viaja)', async () => {
    const w = mountForm()
    await fill(w, CURRENT, NEW, NEW)
    await submit(w)
    expect(w.emitted('submit')).toEqual([[{ currentPassword: CURRENT, newPassword: NEW }]])
  })

  it('con loading: deshabilita campos y botón, y no vuelve a enviar', async () => {
    const w = mountForm({ loading: true })
    expect(inputs(w).every((f) => f.attributes('disabled') !== undefined)).toBe(true)
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    await fill(w, CURRENT, NEW, NEW)
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('nunca guarda las contraseñas en el almacenamiento del navegador ni las escribe en consola', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}))
    localStorage.clear()
    sessionStorage.clear()
    const w = mountForm()
    await fill(w, CURRENT, NEW, NEW)
    await submit(w)

    expect(JSON.stringify({ ...localStorage })).not.toContain(CURRENT)
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(NEW)
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
  })
})

describe('ChangePasswordForm — errores que manda la vista', () => {
  it('currentPasswordError aparece bajo el campo de la contraseña actual', () => {
    const w = mountForm({ currentPasswordError: 'La contraseña actual no es correcta.' })
    expect(errors(w)).toEqual(['La contraseña actual no es correcta.'])
    expect(inputs(w)[0].attributes('aria-invalid')).toBe('true')
    expect(inputs(w)[1].attributes('aria-invalid')).toBeUndefined()
  })

  it('newPasswordError aparece bajo el campo de la contraseña nueva', () => {
    const w = mountForm({ newPasswordError: 'Usa entre 10 y 128 caracteres.' })
    expect(errors(w)).toEqual(['Usa entre 10 y 128 caracteres.'])
    expect(inputs(w)[1].attributes('aria-invalid')).toBe('true')
  })

  it('error general se muestra en una alerta y el formulario sigue editable', () => {
    const w = mountForm({ error: 'No pudimos conectarnos.' })
    expect(w.find('[role="alert"]').text()).toContain('No pudimos conectarnos.')
    expect(inputs(w).every((f) => f.attributes('disabled') === undefined)).toBe(true)
  })

  it('al escribir de nuevo en la contraseña actual, su error del servidor no estorba al validar', async () => {
    const w = mountForm({ currentPasswordError: 'La contraseña actual no es correcta.' })
    await fill(w, CURRENT, NEW, NEW)
    await submit(w)
    expect(w.emitted('submit')).toHaveLength(1)
  })
})
