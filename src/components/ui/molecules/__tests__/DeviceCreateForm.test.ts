import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DeviceCreateForm from '../DeviceCreateForm.vue'

function mountForm(props: Record<string, unknown> = {}) {
  return mount(DeviceCreateForm, { props })
}
type Wrapper = ReturnType<typeof mountForm>

const byLabel = (w: Wrapper, label: string) => {
  const l = w.findAll('label').find((x) => x.text() === label)
  if (!l) throw new Error(`No hay campo "${label}"`)
  return w.get(`#${l.attributes('for')}`)
}
const errors = (w: Wrapper) => w.findAll('.app-input__error').map((e) => e.text())
const submit = (w: Wrapper) => w.find('form').trigger('submit')
const NAME = 'Nombre del dispositivo'
const CORREO = 'Correo para enviarle el código (opcional)'

describe('DeviceCreateForm — estructura', () => {
  it('tiene el nombre y un correo opcional, cada uno con su etiqueta', () => {
    const w = mountForm()
    expect(w.findAll('label').map((l) => l.text())).toEqual([NAME, CORREO])
  })

  it('explica que quien lo active debe escribir el nombre exactamente igual', () => {
    expect(mountForm().text()).toContain('exactamente igual')
  })

  it('explica que sin correo el código se muestra para compartirlo', () => {
    expect(mountForm().text()).toMatch(/sin correo|Déjalo vacío/)
  })

  it('el correo es de tipo email y nada se autocompleta', () => {
    const w = mountForm()
    expect(byLabel(w, CORREO).attributes('type')).toBe('email')
    expect(byLabel(w, NAME).attributes('autocomplete')).toBe('off')
    expect(byLabel(w, CORREO).attributes('autocomplete')).toBe('off')
  })

  it('tiene botón de registrar (submit) y de cancelar (no envía)', async () => {
    const w = mountForm()
    expect(w.get('button[type="submit"]').text()).toBe('Registrar dispositivo')
    const cancel = w.findAll('button').find((b) => b.text() === 'Cancelar')!
    expect(cancel.attributes('type')).toBe('button')
    await cancel.trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    expect(w.emitted('submit')).toBeUndefined()
  })
})

describe('DeviceCreateForm — validación', () => {
  it('sin nombre: no envía y lo dice', async () => {
    const w = mountForm()
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['Escribe el nombre del dispositivo.'])
    expect(byLabel(w, NAME).attributes('aria-invalid')).toBe('true')
  })

  it('un nombre de solo espacios cuenta como vacío', async () => {
    const w = mountForm()
    await byLabel(w, NAME).setValue('    ')
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('más de 100 caracteres: no envía; exactamente 100 sí', async () => {
    const w = mountForm()
    await byLabel(w, NAME).setValue('a'.repeat(101))
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['El nombre es demasiado largo (máximo 100 caracteres).'])

    await byLabel(w, NAME).setValue('a'.repeat(100))
    await submit(w)
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it.each(['ana', 'ana@', 'ana@example', 'a b@example.com'])('correo inválido %j: no envía', async (correo) => {
    const w = mountForm()
    await byLabel(w, NAME).setValue('Tablet')
    await byLabel(w, CORREO).setValue(correo)
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
    expect(errors(w)).toEqual(['Escribe un correo válido, por ejemplo nombre@dominio.com'])
  })

  it('el correo vacío es válido (opcional)', async () => {
    const w = mountForm()
    await byLabel(w, NAME).setValue('Tablet')
    await submit(w)
    expect(w.emitted('submit')).toHaveLength(1)
  })
})

describe('DeviceCreateForm — lo que se envía', () => {
  it('solo el nombre: correoEnvio NO viaja', async () => {
    const w = mountForm()
    await byLabel(w, NAME).setValue('Tablet')
    await submit(w)
    const payload = w.emitted('submit')![0][0] as Record<string, unknown>
    expect(payload).toEqual({ name: 'Tablet' })
    expect('correoEnvio' in payload).toBe(false)
  })

  it('con correo: viaja recortado junto al nombre recortado', async () => {
    const w = mountForm()
    await byLabel(w, NAME).setValue('  Tablet de Ana  ')
    await byLabel(w, CORREO).setValue('  ana@example.com ')
    await submit(w)
    expect(w.emitted('submit')![0][0]).toEqual({ name: 'Tablet de Ana', correoEnvio: 'ana@example.com' })
  })

  it('un correo de solo espacios se trata como vacío', async () => {
    const w = mountForm()
    await byLabel(w, NAME).setValue('Tablet')
    await byLabel(w, CORREO).setValue('   ')
    await submit(w)
    expect(w.emitted('submit')![0][0]).toEqual({ name: 'Tablet' })
  })
})

describe('DeviceCreateForm — carga y errores del servidor', () => {
  it('con loading: campos y botones deshabilitados y no vuelve a enviar', async () => {
    const w = mountForm({ loading: true })
    expect(w.findAll('input').every((f) => f.attributes('disabled') !== undefined)).toBe(true)
    expect(w.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    await byLabel(w, NAME).setValue('Tablet')
    await submit(w)
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('serverErrors se muestran bajo cada campo', () => {
    const w = mountForm({ serverErrors: { name: 'Nombre malo', correoEnvio: 'Correo malo' } })
    expect(errors(w)).toEqual(['Nombre malo', 'Correo malo'])
  })

  it('error general en una alerta, con el formulario editable', () => {
    const w = mountForm({ error: 'No pudimos conectarnos.' })
    expect(w.get('[role="alert"]').text()).toContain('No pudimos conectarnos.')
    expect(w.findAll('input').every((f) => f.attributes('disabled') === undefined)).toBe(true)
  })
})
